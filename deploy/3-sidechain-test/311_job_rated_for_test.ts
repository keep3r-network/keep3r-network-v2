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

  const jobForTest = await hre.deployments.deploy('BasicJob', {
    from: deployer,
    contract: 'solidity/for-test/JobRatedForTest.sol:JobRatedForTest',
    args: [keep3rV2.address],
    log: true,
  });

  // register job
  if (jobForTest.newlyDeployed) {
    await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'addJob', jobForTest.address);
  }

  const LIQUIDITY = await hre.deployments.read('Keep3rSidechainForTestnet', 'liquidityAmount', jobForTest.address, wkLP);
  if (LIQUIDITY == 0) {
    // deployer needs to have kLP balance
    const keep3rSidechain = await hre.deployments.get('Keep3rSidechainForTestnet');
    await hre.deployments.execute('wkLP', { from: deployer, log: true }, 'approve', keep3rSidechain.address, toUnit(10));
    await hre.deployments.execute(
      'Keep3rSidechainForTestnet',
      { from: deployer, log: true },
      'addLiquidityToJob',
      jobForTest.address,
      wkLP,
      toUnit(1)
    );
  }

  const IS_KEEPER = await hre.deployments.read('Keep3rSidechainForTestnet', 'isKeeper', deployer);
  if (!IS_KEEPER) {
    // register deployer as keeper
    await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true }, 'bond', kp3rV1, 0);
    await hre.deployments.execute('Keep3rSidechainForTestnet', { from: deployer, log: true, gasLimit: 1e6 }, 'activate', kp3rV1);
  }

  await hre.deployments.execute('BasicJob', { from: deployer, log: true, gasLimit: 1e6 }, 'work');
};

deployFunction.dependencies = ['approve-testnet-liquidity'];
deployFunction.tags = ['job-rated-for-test'];

export default deployFunction;
