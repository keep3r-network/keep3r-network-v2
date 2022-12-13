import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, kp3rV1 } = await hre.getNamedAccounts();

  await hre.deployments.deploy('Keep3rEscrow', {
    contract: 'solidity/contracts/sidechain/Keep3rEscrow.sol:Keep3rEscrow',
    from: deployer,
    log: true,
    args: [governor, kp3rV1],
  });
};

deployFunction.dependencies = ['keep3r-v1'];
deployFunction.tags = ['keep3r-escrow'];

export default deployFunction;
