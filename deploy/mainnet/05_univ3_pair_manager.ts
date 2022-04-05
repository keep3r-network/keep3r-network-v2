import IUniV3PairManager from '@solidity/interfaces/IUniV3PairManager.sol/IUniV3PairManager.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KP3R_WETH_V3_POOL } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  await hre.deployments.execute('UniV3PairManagerFactory', { from: deployer, gasLimit: 3e6, log: true }, 'createPairManager', KP3R_WETH_V3_POOL);

  const pairManagerAddress = await hre.deployments.read('UniV3PairManagerFactory', 'pairManagers', KP3R_WETH_V3_POOL);

  hre.deployments.save('UniV3PairManager', {
    address: pairManagerAddress,
    abi: IUniV3PairManager.abi,
  });
};

deployFunction.tags = ['deploy-pair-manager', 'uni-v3-pair-manager', 'mainnet'];

export default deployFunction;
