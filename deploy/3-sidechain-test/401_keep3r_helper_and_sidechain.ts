import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, kp3rV1, weth, kp3rWethOracle, wethUsdOracle } = await hre.getNamedAccounts();

  const keep3rEscrow = await hre.deployments.get('Keep3rEscrow');

  // precalculate the address of Keep3rV2 contract
  const currentNonce: number = await hre.ethers.provider.getTransactionCount(deployer);
  const keeperV2Address: string = hre.ethers.utils.getContractAddress({ from: deployer, nonce: currentNonce + 1 });

  const keep3rHelperArgs = [keeperV2Address, governor, kp3rV1, weth, kp3rWethOracle, wethUsdOracle];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelperSidechainForTestnet', {
    from: deployer,
    contract: 'solidity/for-test/testnet/Keep3rHelperSidechainForTestnet.sol:Keep3rHelperSidechainForTestnet',
    args: keep3rHelperArgs,
    log: true,
  });

  const keep3rV2Args = [governor, keep3rHelper.address, kp3rV1, keep3rEscrow.address];

  const keep3r = await hre.deployments.deploy('Keep3rSidechainForTestnet', {
    contract: 'solidity/for-test/testnet/Keep3rSidechainForTestnet.sol:Keep3rSidechainForTestnet',
    from: deployer,
    args: keep3rV2Args,
    log: true,
  });

  await hre.deployments.execute('Keep3rEscrow', { from: deployer, log: true }, 'setMinter', keep3r.address);
};

deployFunction.dependencies = ['keep3r-escrow', 'save-oracles'];
deployFunction.tags = ['testnet-keep3r-sidechain'];

export default deployFunction;
