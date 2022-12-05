import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rFaucet, kp3rWethOracle } = await hre.getNamedAccounts();
  const pairManager = await hre.deployments.get('UniV3PairManager');
  const kp3rV1 = await hre.deployments.get('KP3Rv1');

  // precalculate the address of Keep3rV2 contract
  const currentNonce: number = await hre.ethers.provider.getTransactionCount(deployer);
  const keeperV2Address: string = hre.ethers.utils.getContractAddress({ from: deployer, nonce: currentNonce + 1 });

  const keep3rHelperArgs = [kp3rV1.address, keeperV2Address, deployer, kp3rWethOracle];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelperForTestnet', {
    from: deployer,
    contract: 'solidity/for-test/testnet/Keep3rHelperForTestnet.sol:Keep3rHelperForTestnet',
    args: keep3rHelperArgs,
    log: true,
  });

  const keep3rV2Args = [deployer, keep3rHelper.address, kp3rV1.address, kp3rFaucet];

  await hre.deployments.deploy('Keep3rForTestnet', {
    contract: 'solidity/for-test/testnet/Keep3rForTestnet.sol:Keep3rForTestnet',
    from: deployer,
    args: keep3rV2Args,
    log: true,
  });

  await hre.deployments.execute('Keep3rForTestnet', { from: deployer, log: true }, 'approveLiquidity', pairManager.address);
};

deployFunction.dependencies = ['testnet-pair-manager'];
deployFunction.tags = ['testnet-keep3r'];

export default deployFunction;
