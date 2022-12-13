import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rV1 } = await hre.getNamedAccounts();
  const kp3RForTest = await hre.deployments.get('KP3Rv1');
  const keep3rV2 = await hre.deployments.get('Keep3rForTestnet');
  const pairManager = await hre.deployments.get('UniV3PairManager');

  const jobForTest = await hre.deployments.deploy('BasicJob', {
    from: deployer,
    contract: 'solidity/for-test/JobForTest.sol:JobForTest',
    args: [keep3rV2.address],
    log: true,
  });

  // register job
  if (jobForTest.newlyDeployed) {
    await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'addJob', jobForTest.address);
  }

  const LIQUIDITY = await hre.deployments.read('Keep3rForTestnet', 'liquidityAmount', jobForTest.address, pairManager.address);
  if (LIQUIDITY == 0) {
    // deployer needs to have KP3R and WETH balance
    let klpBalance = await hre.deployments.read('UniV3PairManager', 'balanceOf', deployer);
    if (klpBalance == 0) {
      const wethBalance = await hre.deployments.read('WETH', 'balanceOf', deployer);
      if (wethBalance < toUnit(1)) {
        await hre.deployments.execute('WETH', { from: deployer, log: true, value: toUnit(0.1) }, 'deposit');
      }
      const kp3rBalance = await hre.deployments.read('KP3Rv1', 'balanceOf', deployer);
      if (kp3rBalance < toUnit(100)) {
        await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'mint(uint256)', toUnit(1));
      }

      await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'approve', pairManager.address, toUnit(100));
      await hre.deployments.execute('WETH', { from: deployer, log: true }, 'approve', pairManager.address, toUnit(100));

      const mintArguments: any[] = [toUnit(1), toUnit(0.1), 0, 0, deployer];
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

  const IS_KEEPER = await hre.deployments.read('Keep3rForTestnet', 'isKeeper', deployer);
  if (!IS_KEEPER) {
    // register deployer as keeper
    await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'bond', kp3RForTest.address, 0);
    await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'activate', kp3RForTest.address);
  }

  await hre.deployments.execute('BasicJob', { from: deployer, log: true, gasLimit: 1e6 }, 'work');
};

deployFunction.dependencies = ['testnet-keep3r'];
deployFunction.tags = ['job-for-test'];

export default deployFunction;
