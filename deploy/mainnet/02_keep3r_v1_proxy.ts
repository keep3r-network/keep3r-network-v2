import IKeep3rV1Proxy from '@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const keep3rV1ProxyAddress = '0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d';

  console.log(`using already deployed "Keep3rV1Proxy" at ${keep3rV1ProxyAddress}`);

  hre.deployments.save('Keep3rV1Proxy', {
    address: keep3rV1ProxyAddress,
    abi: IKeep3rV1Proxy.abi,
  });
};

deployFunction.tags = ['Keep3rV1Proxy', 'mainnet'];

export default deployFunction;
