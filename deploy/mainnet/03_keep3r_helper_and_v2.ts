import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const currentNonce: number = await hre.ethers.provider.getTransactionCount(deployer);

  // precalculate the address of Keep3rV2 contract
  const keeperV2Address: string = hre.ethers.utils.getContractAddress({ from: deployer, nonce: currentNonce + 1 });

  const governance = deployer;
  const keep3rV1 = await hre.deployments.get('Keep3rV1');
  const keep3rV1Proxy = await hre.deployments.get('Keep3rV1Proxy');

  const keep3rHelperArgs = [keeperV2Address];

  const keep3rHelper = await hre.deployments.deploy('Keep3rHelper', {
    from: deployer,
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    args: keep3rHelperArgs,
    log: true,
  });

  // pool to use as a KP3R/WETH oracle
  const uniV3PoolAddress = '0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5';

  const keep3rV2Args = [governance, keep3rHelper.address, keep3rV1.address, keep3rV1Proxy.address, uniV3PoolAddress];

  const keep3rV2 = await hre.deployments.deploy('Keep3r', {
    contract: 'solidity/contracts/Keep3r.sol:Keep3r',
    from: deployer,
    args: keep3rV2Args,
    log: true,
  });
};

deployFunction.tags = ['Keep3r', 'mainnet'];

export default deployFunction;
