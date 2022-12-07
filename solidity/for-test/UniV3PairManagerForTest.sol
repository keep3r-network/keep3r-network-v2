// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import '../contracts/libraries/LiquidityAmounts.sol';
import '../contracts/libraries/FixedPoint96.sol';
import '../contracts/libraries/FullMath.sol';
import '../contracts/libraries/TickMath.sol';
import '../contracts/UniV3PairManager.sol';
import '../interfaces/external/IWeth9.sol';
import '../interfaces/IUniV3PairManager.sol';

contract UniV3PairManagerForTest is UniV3PairManager {
  constructor(address _pool, address _governance) UniV3PairManager(_pool, _governance) {}

  function internalAddLiquidity(
    uint256 amount0Desired,
    uint256 amount1Desired,
    uint256 amount0Min,
    uint256 amount1Min
  )
    external
    returns (
      uint128 liquidity,
      uint256 amount0,
      uint256 amount1
    )
  {
    return _addLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
  }

  function internalPay(
    address token,
    address payer,
    address recipient,
    uint256 value
  ) external {
    return _pay(token, payer, recipient, value);
  }

  function internalMint(address dst, uint256 amount) external {
    return _mint(dst, amount);
  }

  function internalBurn(address dst, uint256 amount) external {
    return _burn(dst, amount);
  }

  function internalTransferTokens(
    address src,
    address dst,
    uint256 amount
  ) external {
    _transferTokens(src, dst, amount);
  }

  function internalSafeTransferFrom(
    address token,
    address from,
    address to,
    uint256 value
  ) external {
    _safeTransferFrom(token, from, to, value);
  }

  receive() external payable {}
}
