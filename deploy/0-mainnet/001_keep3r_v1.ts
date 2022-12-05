import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import IERC20 from '../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { kp3rV1 } = await hre.getNamedAccounts();

  hre.deployments.save('KP3Rv1', {
    address: kp3rV1,
    abi: IERC20.abi,
  });
};

deployFunction.tags = ['keep3r-v1'];

export default deployFunction;
