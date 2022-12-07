import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rV1 } = await hre.getNamedAccounts();
  const keep3rV2 = await hre.deployments.get('Keep3rSidechainForTestnet');

  await hre.deployments.delete('BasicJob');
  const jobForTest = await hre.deployments.deploy('BasicJob', {
    from: deployer,
    contract: 'solidity/for-test/JobRatedForTest.sol:JobRatedForTest',
    args: [keep3rV2.address],
    log: true,
  });

  // register job
  await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'addJob', jobForTest.address);

  const keep3rSidechain = await hre.deployments.get('Keep3rSidechainForTestnet');
  await hre.deployments.execute('KP3Rv1', { from: deployer, log: true }, 'approve', keep3rSidechain.address, toUnit(10));
  await hre.deployments.execute(
    'Keep3rSidechainForTestnet',
    { from: deployer, log: true },
    'addLiquidityToJob',
    jobForTest.address,
    kp3rV1,
    toUnit(10)
  );

  await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'bond', kp3rV1, 0);
  await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true, gasLimit: 1e6 }, 'activate', kp3rV1);
};

deployFunction.dependencies = ['approve-testnet-liquidity'];
deployFunction.tags = ['job-rated-for-test'];

export default deployFunction;
