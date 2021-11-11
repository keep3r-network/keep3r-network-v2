import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const governance = deployer;
  const keep3rV1 = await hre.deployments.get('Keep3rV1');
  const keep3rV1Proxy = await hre.deployments.get('Keep3rV1Proxy');
  const keep3rHelper = await hre.deployments.get('Keep3rHelper');
  const keep3rV2 = await hre.deployments.get('Keep3r');
  const uniV3PairManagerFactory = await hre.deployments.get('UniV3PairManagerFactory');

  const keep3rHelperArgs = [keep3rV2.address];
  const uniV3PoolAddress = '0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5';
  const keep3rV2Args = [governance, keep3rHelper.address, keep3rV1.address, keep3rV1Proxy.address, uniV3PoolAddress];

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    address: keep3rHelper.address,
    constructorArguments: keep3rHelperArgs,
  });

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/Keep3r.sol:Keep3r',
    address: keep3rV2.address,
    constructorArguments: keep3rV2Args,
  });

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/UniV3PairManagerFactory.sol:UniV3PairManagerFactory',
    address: uniV3PairManagerFactory.address,
  });
};

deployFunction.tags = ['verify', 'mainnet'];

export default deployFunction;
