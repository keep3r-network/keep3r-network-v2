import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const uniV3PairManagerFactory = await hre.deployments.get('UniV3PairManagerFactory');

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/UniV3PairManagerFactory.sol:UniV3PairManagerFactory',
    address: uniV3PairManagerFactory.address,
    constructorArguments: uniV3PairManagerFactory.args,
  });
};

deployFunction.tags = ['verify-factory', 'mainnet'];

export default deployFunction;
