import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const keep3rHelper = await hre.deployments.get('Keep3rHelper');
  const keep3rV2 = await hre.deployments.get('Keep3r');

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    address: keep3rHelper.address,
    constructorArguments: keep3rHelper.args,
  });

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/Keep3r.sol:Keep3r',
    address: keep3rV2.address,
    constructorArguments: keep3rV2.args,
  });
};

deployFunction.tags = ['verify-keep3r', 'mainnet'];

export default deployFunction;
