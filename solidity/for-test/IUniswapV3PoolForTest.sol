//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@uniswap/v3-core/contracts/interfaces/IERC20Minimal.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

// solhint-disable-next-line no-empty-blocks
interface IUniswapV3PoolForTest is IERC20Minimal, IUniswapV3Pool {

}
