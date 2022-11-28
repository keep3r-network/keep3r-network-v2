import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { KEEP3R_MSIG, KEEP3R_V1, KEEP3R_V1_PROXY, KP3R_WETH_V3_POOL } from './constants';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  // precalculate the address of Keep3rV2 contract
  const currentNonce: number = await hre.ethers.provider.getTransactionCount(deployer);
  const keeperV2Address: string = hre.ethers.utils.getContractAddress({ from: deployer, nonce: currentNonce + 1 });

  const keep3rHelperArgs = [keeperV2Address, KEEP3R_MSIG, KP3R_WETH_V3_POOL];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelper', {
    from: deployer,
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    args: keep3rHelperArgs,
    log: true,
  });

  const keep3rV2Args = [deployer, keep3rHelper.address, KEEP3R_V1, KEEP3R_V1_PROXY];

  await hre.deployments.deploy('Keep3r', {
    contract: 'solidity/contracts/Keep3r.sol:Keep3r',
    from: deployer,
    args: keep3rV2Args,
    log: true,
  });
};

deployFunction.tags = ['deploy-keep3r', 'keep3r', 'mainnet'];

export default deployFunction;
