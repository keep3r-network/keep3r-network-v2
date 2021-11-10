import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  // pool to use as a KP3R/WETH liquidity
  const uniV3PoolAddress = '0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5';

  var pairManagerAddress = await hre.deployments.read('UniV3PairManagerFactory', 'pairManagers', uniV3PoolAddress);

  await hre.deployments.execute('Keep3r', { from: deployer, gasLimit: 1000000, log: true }, 'approveLiquidity', pairManagerAddress);
};

deployFunction.tags = ['UniV3PairManager', 'KP3RWETHPair', 'mainnet'];

export default deployFunction;
