import { WETH_ADDRESS } from '@e2e/common';
import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const kp3RForTest = await hre.deployments.get('KP3Rv1');
  const keep3rV2 = await hre.deployments.get('Keep3rForTestnet');
  const pairManager = await hre.deployments.get('UniV3PairManager');

  const jobForTest = await hre.deployments.deploy('JobForTest', {
    from: deployer,
    contract: 'solidity/for-test/JobForTest.sol:JobForTest',
    args: [keep3rV2.address],
    log: true,
  });

  const jobs = await hre.deployments.read('Keep3rForTestnet', 'jobs');

  if (!jobs.includes(jobForTest.address)) {
    await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'addJob', jobForTest.address);
  }

  const liquidity = await hre.deployments.read('Keep3rForTestnet', 'liquidityAmount', jobForTest.address, pairManager.address);

  if (liquidity == 0) {
    // deployer needs to have KP3R and WETH balance
    let klpBalance = await hre.deployments.read('UniV3PairManager', 'balanceOf', deployer);
    if (klpBalance == 0) {
      const wethBalance = await hre.deployments.read('WETH', 'balanceOf', deployer);
      if (wethBalance < toUnit(0.1)) {
        await hre.deployments.execute('WETH', { from: deployer, log: true, value: toUnit(0.1) }, 'deposit');
      }
      const kp3rBalance = await hre.deployments.read('KP3Rv1', 'balanceOf', deployer);
      if (kp3rBalance < toUnit(10)) {
        await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'mint(uint256)', toUnit(100_000));
      }

      await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'approve', pairManager.address, toUnit(100));
      await hre.deployments.execute('WETH', { from: deployer, log: true }, 'approve', pairManager.address, toUnit(100_000));

      let mintArguments: any[];

      // Check if WETH is the first token in the pair
      if (WETH_ADDRESS > kp3RForTest.address) {
        mintArguments = [toUnit(0.1), toUnit(100_000), 0, 0, deployer];
      } else {
        mintArguments = [toUnit(100_000), toUnit(0.1), 0, 0, deployer];
      }

      await hre.deployments.execute('UniV3PairManager', { from: deployer, log: true }, 'mint', ...mintArguments);

      klpBalance = await hre.deployments.read('UniV3PairManager', 'balanceOf', deployer);
    }

    // add liquidity to job
    await hre.deployments.execute('UniV3PairManager', { from: deployer, log: true }, 'approve', keep3rV2.address, klpBalance);
    await hre.deployments.execute(
      'Keep3rForTestnet',
      { from: deployer, log: true },
      'addLiquidityToJob',
      jobForTest.address,
      pairManager.address,
      klpBalance
    );
  }

  const isKeeper = await hre.deployments.read('Keep3rForTestnet', 'isKeeper', deployer);
  if (!isKeeper) {
    // register deployer as keeper
    await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'bond', kp3RForTest.address, 0);

    // wait for bond to be processed
    console.log('waiting for bond to be processed');
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'activate', kp3RForTest.address);
  }

  await hre.deployments.execute('JobForTest', { from: deployer, log: true, gasLimit: 1e6 }, 'work');
};

deployFunction.dependencies = ['testnet-keep3r'];
deployFunction.tags = ['job-for-test'];

export default deployFunction;
