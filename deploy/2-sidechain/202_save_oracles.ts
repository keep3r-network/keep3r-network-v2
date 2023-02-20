import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import IUniswapV3Pool from '../../artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { kp3rWethOracle, wethUsdOracle } = await hre.getNamedAccounts();

  hre.deployments.save('Kp3rWethOracle', {
    address: kp3rWethOracle,
    abi: IUniswapV3Pool.abi,
  });

  hre.deployments.save('WethUsdOracle', {
    address: wethUsdOracle,
    abi: IUniswapV3Pool.abi,
  });
};

deployFunction.tags = ['save-oracles'];

export default deployFunction;
