// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../IKeep3rHelper.sol';

/// @title Keep3rHelperSidechain contract
/// @notice Contains all the helper functions for sidechain keep3r implementations
interface IKeep3rHelperSidechain is IKeep3rHelper {
  // Events

  /// @notice The oracle for a liquidity has been saved
  /// @param _liquidity The address of the given liquidity
  /// @param _oraclePool The address of the oracle pool
  event OracleSet(address _liquidity, address _oraclePool);

  /// @notice Emitted when the WETH USD pool is changed
  /// @param _address Address of the new WETH USD pool
  /// @param _isWETHToken0 True if calling the token0 method of the pool returns the WETH token address
  event WethUSDPoolChange(address _address, bool _isWETHToken0);

  /// Variables

  /// @notice Ethereum mainnet WETH address used for quoting references
  /// @return _weth Address of WETH token
  // solhint-disable func-name-mixedcase
  function WETH() external view returns (address _weth);

  /// @return _oracle The address of the observable pool for given liquidity
  function oracle(address _liquidity) external view returns (address _oracle);

  /// @notice WETH-USD pool that is being used as oracle
  /// @return poolAddress Address of the pool
  /// @return isTKNToken0 True if calling the token0 method of the pool returns the WETH token address
  function wethUSDPool() external view returns (address poolAddress, bool isTKNToken0);

  /// @notice Quotes USD to ETH
  /// @dev Used to know how much ETH should be paid to keepers before converting it from ETH to KP3R
  /// @param _usd The amount of USD to quote to ETH
  /// @return _eth The resulting amount of ETH after quoting the USD
  function quoteUsdToEth(uint256 _usd) external returns (uint256 _eth);

  /// Methods

  /// @notice Sets an oracle for a given liquidity
  /// @param _liquidity The address of the liquidity
  /// @param _oracle The address of the pool used to quote the liquidity from
  /// @dev The oracle must contain KP3R as either token0 or token1
  function setOracle(address _liquidity, address _oracle) external;

  /// @notice Sets an oracle for querying WETH/USD quote
  /// @param _poolAddress The address of the pool used as oracle
  /// @dev The oracle must contain WETH as either token0 or token1
  function setWethUsdPool(address _poolAddress) external;
}
