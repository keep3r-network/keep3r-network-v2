import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContractByAddress } from 'utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { governor, kp3rWethOracle } = await hre.getNamedAccounts();
  const pairManager = await hre.deployments.get('UniV3PairManager');

  const deploymentArgs = [kp3rWethOracle, governor];

  await verifyContractByAddress(hre, pairManager.address, deploymentArgs);
};

deployFunction.tags = ['verify-pair-manager'];

export default deployFunction;
