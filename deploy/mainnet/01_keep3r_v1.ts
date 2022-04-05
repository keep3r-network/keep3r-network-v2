import IKeep3rV1 from '@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KEEP3R_V1 } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`using already deployed "Keep3rV1" at ${KEEP3R_V1}`);

  hre.deployments.save('Keep3rV1', {
    address: KEEP3R_V1,
    abi: IKeep3rV1.abi,
  });
};

deployFunction.tags = ['keep3r-v1', 'keep3r', 'mainnet'];

export default deployFunction;
