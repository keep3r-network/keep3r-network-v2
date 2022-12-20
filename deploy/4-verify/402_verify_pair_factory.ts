import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContract } from 'utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const uniV3PairManagerFactory = await hre.deployments.get('UniV3PairManagerFactory');
  await verifyContract(hre, uniV3PairManagerFactory);
};

deployFunction.tags = ['verify-factory'];

export default deployFunction;
