import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KEEP3R_MSIG, KP3R_WETH_V3_POOL } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const pairManager = await hre.deployments.get('UniV3PairManager');

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/UniV3PairManager.sol:UniV3PairManager',
    address: pairManager.address,
    constructorArguments: [KP3R_WETH_V3_POOL, KEEP3R_MSIG],
  });
};

deployFunction.tags = ['verify-pair-manager', 'pair-manager', 'mainnet'];

export default deployFunction;
