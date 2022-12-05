import IUniV3PairManager from '@solidity/interfaces/IUniV3PairManager.sol/IUniV3PairManager.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rWethOracle } = await hre.getNamedAccounts();

  await hre.deployments.execute('UniV3PairManagerFactory', { from: deployer, gasLimit: 3e6, log: true }, 'createPairManager', kp3rWethOracle);

  const pairManagerAddress = await hre.deployments.read('UniV3PairManagerFactory', 'pairManagers', kp3rWethOracle);

  hre.deployments.save('UniV3PairManager', {
    address: pairManagerAddress,
    abi: IUniV3PairManager.abi,
  });
};

deployFunction.dependencies = ['pair-manager-factory'];
deployFunction.tags = ['create-pair-manager'];

export default deployFunction;
