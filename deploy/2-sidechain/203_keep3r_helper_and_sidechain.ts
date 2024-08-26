import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, kp3rV1, weth, kp3rWethOracle, wethUsdOracle, usdDecimals } = await hre.getNamedAccounts();
  const { kp3rV1: mainnetKp3rV1 } = await hre.companionNetworks['mainnet'].getNamedAccounts();

  const keep3rEscrow = await hre.deployments.get('Keep3rEscrow');

  // precalculate the address of Keep3rV2 contract
  const currentNonce: number = await hre.ethers.provider.getTransactionCount(deployer);
  const keeperV2Address: string = hre.ethers.utils.getContractAddress({ from: deployer, nonce: currentNonce + 1 });

  const keep3rHelperArgs = [keeperV2Address, governor, mainnetKp3rV1, weth, kp3rWethOracle, wethUsdOracle, usdDecimals];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelperSidechain', {
    from: deployer,
    contract: 'solidity/contracts/sidechain/Keep3rHelperSidechain.sol:Keep3rHelperSidechain',
    args: keep3rHelperArgs,
    log: true,
  });

  const keep3rV2Args = [governor, keep3rHelper.address, kp3rV1, keep3rEscrow.address];

  await hre.deployments.deploy('Keep3rSidechain', {
    contract: 'solidity/contracts/sidechain/Keep3rSidechain.sol:Keep3rSidechain',
    from: deployer,
    args: keep3rV2Args,
    log: true,
  });
};

deployFunction.dependencies = ['keep3r-escrow', 'save-oracles'];
deployFunction.tags = ['keep3r-sidechain'];

export default deployFunction;
