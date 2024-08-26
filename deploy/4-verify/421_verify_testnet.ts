import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContract } from 'utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const pairManager = await hre.deployments.get('UniV3PairManager');
  await verifyContract(hre, pairManager);

  const keep3rHelper = await hre.deployments.get('Keep3rHelper');
  await verifyContract(hre, keep3rHelper);

  const keep3rV2 = await hre.deployments.get('Keep3rForTestnet');
  await verifyContract(hre, keep3rV2);

  const jobForTest = await hre.deployments.getOrNull('JobForTest');
  if (jobForTest) {
    await verifyContract(hre, jobForTest);
  }
};

deployFunction.tags = ['verify-testnet'];

export default deployFunction;
