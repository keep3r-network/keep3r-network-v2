import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rWethOracle, wkLP } = await hre.getNamedAccounts();
  const keep3rEscrow = await hre.deployments.get('Keep3rEscrow');
  const keep3r = await hre.deployments.get('Keep3rSidechainForTestnet');

  await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'approve', keep3rEscrow.address, toUnit(100));
  await hre.deployments.execute('Keep3rEscrow', { from: deployer, log: true }, 'deposit', toUnit(100));
  await hre.deployments.execute('Keep3rEscrow', { from: deployer, log: true }, 'setMinter', keep3r.address);

  await hre.deployments.execute('Keep3rHelperSidechain', { from: deployer, log: true }, 'setOracle', wkLP, kp3rWethOracle);
  await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'approveLiquidity', wkLP);
};

deployFunction.dependencies = ['testnet-keep3r-sidechain'];
deployFunction.tags = ['approve-testnet-liquidity'];

export default deployFunction;
