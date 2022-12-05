import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  await hre.deployments.deploy('UniV3PairManagerFactory', {
    contract: 'solidity/contracts/UniV3PairManagerFactory.sol:UniV3PairManagerFactory',
    from: deployer,
    log: true,
    args: [governor],
  });
};

deployFunction.tags = ['pair-manager-factory'];

export default deployFunction;
