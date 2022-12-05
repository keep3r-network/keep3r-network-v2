import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const uniV3Pool = await hre.deployments.get('UniV3Pool');

  await hre.deployments.deploy('UniV3PairManager', {
    contract: 'solidity/contracts/UniV3PairManager.sol:UniV3PairManager',
    from: deployer,
    log: true,
    args: [uniV3Pool.address, deployer],
  });
};

deployFunction.dependencies = ['testnet-pool'];
deployFunction.tags = ['testnet-pair-manager'];

export default deployFunction;
