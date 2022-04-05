import IKeep3rV1Proxy from '@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KEEP3R_V1_PROXY } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`using already deployed "Keep3rV1Proxy" at ${KEEP3R_V1_PROXY}`);

  hre.deployments.save('Keep3rV1Proxy', {
    address: KEEP3R_V1_PROXY,
    abi: IKeep3rV1Proxy.abi,
  });
};

deployFunction.tags = ['keep3r-v1-proxy', 'keep3r', 'mainnet'];

export default deployFunction;
