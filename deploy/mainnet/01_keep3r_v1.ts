import IKeep3rV1 from '@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const keep3rV1Address = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';

  console.log(`using already deployed "Keep3rV1" at ${keep3rV1Address}`);

  hre.deployments.save('Keep3rV1', {
    address: keep3rV1Address,
    abi: IKeep3rV1.abi,
  });
};

deployFunction.tags = ['Keep3rV1', 'Keep3r', 'mainnet'];

export default deployFunction;
