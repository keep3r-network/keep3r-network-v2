import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const kp3RForTest = await hre.deployments.get('KP3Rv1');
  const keep3rV2 = await hre.deployments.get('Keep3rForTestnet');
  const pairManager = await hre.deployments.get('UniV3PairManager');

  await hre.deployments.delete('BasicJob');
  const jobForTest = await hre.deployments.deploy('BasicJob', {
    from: deployer,
    contract: 'solidity/for-test/BasicJob.sol:BasicJob',
    args: [keep3rV2.address],
    log: true,
  });

  // register job
  await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'addJob', jobForTest.address);

  // mint kLPs
  let klpBalance = await hre.deployments.read('UniV3PairManager', 'balanceOf', deployer);
  if (klpBalance == 0) {
    const wethBalance = await hre.deployments.read('WETH', 'balanceOf', deployer);
    if (wethBalance < toUnit(0.1)) {
      await hre.deployments.execute('WETH', { from: deployer, log: true, value: toUnit(0.1) }, 'deposit');
    }
    const kp3rBalance = await hre.deployments.read('KP3Rv1', 'balanceOf', deployer);
    if (kp3rBalance < toUnit(1)) {
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

  // register deployer as keeper
  await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'bond', kp3RForTest.address, 0);
  await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'activate', kp3RForTest.address);
};

deployFunction.dependencies = ['testnet-keep3r'];
deployFunction.tags = ['job-for-test'];

export default deployFunction;
