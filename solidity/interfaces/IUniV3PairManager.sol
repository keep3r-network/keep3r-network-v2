// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '../libraries/PoolAddress.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './peripherals/IGovernable.sol';

interface IPairManager is IERC20Metadata {
  function pool() external view returns (address);

  function token0() external view returns (address);

  function token1() external view returns (address);
}

interface IUniV3PairManager is IGovernable, IPairManager {
  //structs
  struct MintCallbackData {
    PoolAddress.PoolKey _poolKey;
    address payer;
  }

  //variables

  function fee() external view returns (uint24);

  function sqrtRatioAX96() external view returns (uint160);

  function sqrtRatioBX96() external view returns (uint160);

  //errors
  error OnlyPool();
  error ExcessiveSlippage();
  error UnsuccessfulCall();
  error UnsuccessfulTransfer();

  //methods

  function uniswapV3MintCallback(
    uint256,
    uint256,
    bytes calldata
  ) external;

  function mint(
    uint256,
    uint256,
    uint256,
    uint256,
    address
  ) external returns (uint128);

  function position()
    external
    view
    returns (
      uint128,
      uint256,
      uint256,
      uint128,
      uint128
    );

  function collect() external returns (uint256, uint256);

  function burn(
    uint128,
    uint256,
    uint256,
    address
  ) external returns (uint256, uint256);
}
