import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rWethOracle, kp3rV1 } = await hre.getNamedAccounts();
  const keep3rEscrow = await hre.deployments.get('Keep3rEscrow');

  await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'approve', keep3rEscrow.address, toUnit(100));
  await hre.deployments.execute('Keep3rEscrow', { from: deployer, log: true, gasLimit: 2e6 }, 'deposit', toUnit(100));

  await hre.deployments.execute('Keep3rHelperSidechainForTestnet', { from: deployer, log: true }, 'setOracle', kp3rV1, kp3rWethOracle);
  await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'approveLiquidity', kp3rV1);
};

deployFunction.dependencies = ['testnet-keep3r-sidechain'];
deployFunction.tags = ['approve-testnet-liquidity'];

export default deployFunction;
