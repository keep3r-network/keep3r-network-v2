import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContract } from 'utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const keep3rEscrow = await hre.deployments.get('Keep3rEscrow');
  await verifyContract(hre, keep3rEscrow);

  const keep3rHelper = await hre.deployments.get('Keep3rHelperSidechain');
  await verifyContract(hre, keep3rHelper);

  const keep3rV2 = await hre.deployments.get('Keep3rSidechainForTestnet');
  await verifyContract(hre, keep3rV2);

  const jobForTest = await hre.deployments.getOrNull('JobRatedForTest');
  if (jobForTest) {
    await verifyContract(hre, jobForTest);
  }
};

deployFunction.tags = ['verify-sidechain-testnet'];

export default deployFunction;
