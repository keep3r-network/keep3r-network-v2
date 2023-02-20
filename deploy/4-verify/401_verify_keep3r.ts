import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContract } from 'utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const keep3rHelper = await hre.deployments.get('Keep3rHelper');
  await verifyContract(hre, keep3rHelper);

  const keep3rV2 = await hre.deployments.get('Keep3r');
  await verifyContract(hre, keep3rV2);
};

deployFunction.tags = ['verify-keep3r'];

export default deployFunction;
