import ERC20ForTest from '@solidity/for-test/ERC20ForTest.sol/ERC20ForTest.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import IUniswapV3Factory from '../../artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import IUniswapV3Pool from '../../artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, weth, uniV3Factory } = await hre.getNamedAccounts();

  const kp3RForTest = await hre.deployments.get('KP3Rv1');

  await hre.deployments.save('WETH', {
    address: weth,
    abi: ERC20ForTest.abi,
  });

  await hre.deployments.save('UniV3Factory', {
    address: uniV3Factory,
    abi: IUniswapV3Factory.abi,
  });

  let deployedPool = await hre.deployments.read('UniV3Factory', 'getPool', kp3RForTest.address, weth, 10_000);
  if (deployedPool == '0x0000000000000000000000000000000000000000') {
    await hre.deployments.execute('UniV3Factory', { from: deployer, log: true }, 'createPool', kp3RForTest.address, weth, 10_000);
    deployedPool = await hre.deployments.read('UniV3Factory', 'getPool', kp3RForTest.address, weth, 10_000);

    // initialize pool
    const initializeArgs: any[] = ['79228802809028250921140']; // close to 1-1
    await hre.deployments.execute('UniV3Pool', { from: deployer, log: true }, 'initialize', ...initializeArgs);
  }

  // save pool to deployments
  await hre.deployments.save('UniV3Pool', {
    address: deployedPool,
    abi: IUniswapV3Pool.abi,
  });
};

deployFunction.dependencies = ['keep3r-v1'];
deployFunction.tags = ['testnet-pool'];

export default deployFunction;
