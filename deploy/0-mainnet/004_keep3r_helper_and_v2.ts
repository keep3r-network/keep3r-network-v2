import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, kp3rV1, kp3rFaucet, kp3rWethOracle } = await hre.getNamedAccounts();

  // precalculate the address of Keep3rV2 contract
  const currentNonce: number = await hre.ethers.provider.getTransactionCount(deployer);
  const keeperV2Address: string = hre.ethers.utils.getContractAddress({ from: deployer, nonce: currentNonce + 1 });

  const keep3rHelperArgs = [kp3rV1, keeperV2Address, governor, kp3rWethOracle];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelper', {
    from: deployer,
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    args: keep3rHelperArgs,
    log: true,
  });

  const keep3rV2Args = [governor, keep3rHelper.address, kp3rV1, kp3rFaucet];

  await hre.deployments.deploy('Keep3r', {
    contract: 'solidity/contracts/Keep3r.sol:Keep3r',
    from: deployer,
    args: keep3rV2Args,
    log: true,
  });
};

deployFunction.dependencies = ['keep3r-v1'];
deployFunction.tags = ['keep3r'];

export default deployFunction;
