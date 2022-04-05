import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KEEP3R_MSIG } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  await hre.deployments.deploy('UniV3PairManagerFactory', {
    contract: 'solidity/contracts/UniV3PairManagerFactory.sol:UniV3PairManagerFactory',
    from: deployer,
    log: true,
    args: [KEEP3R_MSIG],
  });
};

deployFunction.tags = ['deploy-factory', 'uni-v3-pair-manager-factory', 'mainnet'];

export default deployFunction;
