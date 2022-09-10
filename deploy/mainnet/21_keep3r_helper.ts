import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KEEP3R_MSIG } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  // precalculate the address of Keep3rV2 contract
  const keep3rV2 = await hre.deployments.get('Keep3r');

  const keep3rHelperArgs = [keep3rV2.address, KEEP3R_MSIG];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelper', {
    from: deployer,
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    args: keep3rHelperArgs,
    log: true,
  });

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    address: keep3rHelper.address,
    constructorArguments: keep3rHelper.args,
  });
};

deployFunction.tags = ['redeploy-keep3r-helper', 'keep3r', 'mainnet'];

export default deployFunction;
