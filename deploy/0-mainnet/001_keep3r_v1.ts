import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import ERC20ForTest from '../../artifacts/solidity/for-test/ERC20ForTest.sol/ERC20ForTest.json';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { kp3rV1 } = await hre.getNamedAccounts();

  await hre.deployments.save('KP3Rv1', {
    address: kp3rV1,
    abi: ERC20ForTest.abi,
  });
};

deployFunction.tags = ['keep3r-v1'];

export default deployFunction;
