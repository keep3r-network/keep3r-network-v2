import { toUnit } from '@utils/bn';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import IERC20 from '../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, kp3rV1, wkLP } = await hre.getNamedAccounts();
  const keep3rV2 = await hre.deployments.get('Keep3rSidechainForTestnet');
  await hre.deployments.save('wkLP', {
    address: wkLP,
    abi: IERC20.abi,
  });

  const jobForTest = await hre.deployments.deploy('JobRatedForTest', {
    from: deployer,
    contract: 'solidity/for-test/JobRatedForTest.sol:JobRatedForTest',
    args: [keep3rV2.address],
    log: true,
  });

  const jobs = await hre.deployments.read('Keep3rSidechainForTestnet', 'jobs');

  if (!jobs.includes(jobForTest.address)) {
    await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'addJob', jobForTest.address);
  }

  const liquidity = await hre.deployments.read('Keep3rSidechainForTestnet', 'liquidityAmount', jobForTest.address, wkLP);
  if (liquidity == 0) {
    // deployer needs to have kLP balance
    const keep3rSidechain = await hre.deployments.get('Keep3rSidechainForTestnet');

    await hre.deployments.execute('wkLP', { from: deployer, log: true }, 'approve', keep3rSidechain.address, toUnit(10));
    await hre.deployments.execute(
      'Keep3rSidechainForTestnet',
      { from: deployer, log: true },
      'addLiquidityToJob',
      jobForTest.address,
      wkLP,
      toUnit(10)
    );
  }

  const isKeeper = await hre.deployments.read('Keep3rSidechainForTestnet', 'isKeeper', deployer);
  if (!isKeeper) {
    // register deployer as keeper
    await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'bond', kp3rV1, 0);

    // wait for bond to be processed
    console.log('waiting for bond to be processed');
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true, gasLimit: 1e6 }, 'activate', kp3rV1);
  }

  await hre.deployments.execute('JobRatedForTest', { from: deployer, log: true, gasLimit: 1e6 }, 'work');
};

deployFunction.dependencies = ['approve-testnet-liquidity'];
deployFunction.tags = ['job-rated-for-test'];

export default deployFunction;
