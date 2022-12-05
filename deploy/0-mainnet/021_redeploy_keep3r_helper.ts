import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor, kp3rV1, kp3rWethOracle } = await hre.getNamedAccounts();

  const keep3rV2 = await hre.deployments.get('Keep3r');
  const keep3rHelperArgs = [kp3rV1, keep3rV2.address, governor, kp3rWethOracle];

  await hre.deployments.delete('Keep3rHelper');
  await hre.deployments.deploy('Keep3rHelper', {
    from: deployer,
    contract: 'solidity/contracts/Keep3rHelper.sol:Keep3rHelper',
    args: keep3rHelperArgs,
    log: true,
  });
};

deployFunction.tags = ['redeploy-keep3r-helper'];

export default deployFunction;
