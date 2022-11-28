// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4 <0.9.0;

import '../Keep3rHelper.sol';
import '../../interfaces/sidechain/IKeep3rHelperSidechain.sol';

contract Keep3rHelperSidechain is IKeep3rHelperSidechain, Keep3rHelper {
  /// @inheritdoc IKeep3rHelperSidechain
  mapping(address => address) public override oracle;
  /// @inheritdoc IKeep3rHelperSidechain
  IKeep3rHelperParameters.TokenOraclePool public override wethUSDPool;

  /// @notice Ethereum mainnet WETH address used for quoting references
  address public immutable override WETH;

  /// @param _keep3rV2 Address of sidechain Keep3r implementation
  /// @param _governance Address of governance
  /// @param _kp3rWethOracle Address of oracle used for KP3R/WETH quote
  /// @param _wethUsdOracle Address of oracle used for WETH/USD quote
  /// @dev Oracle pools should use 18 decimals tokens
  constructor(
    address _keep3rV2,
    address _governance,
    address _kp3r,
    address _weth,
    address _kp3rWethOracle,
    address _wethUsdOracle
  ) Keep3rHelper(_kp3r, _keep3rV2, _governance, _kp3rWethOracle) {
    WETH = _weth;
    wethUSDPool = _validateOraclePool(_wethUsdOracle, _weth);
    _setQuoteTwapTime(1 days);
  }

  /// @inheritdoc IKeep3rHelper
  /// @notice Uses valid wKP3R address from Keep3rSidechain to query keeper bonds
  function bonds(address _keeper) public view override(Keep3rHelper, IKeep3rHelper) returns (uint256 _amountBonded) {
    address wKP3R = IKeep3r(keep3rV2).keep3rV1();
    return IKeep3r(keep3rV2).bonds(_keeper, wKP3R);
  }

  /// @inheritdoc IKeep3rHelperSidechain
  function setOracle(address _liquidity, address _oracle) external override onlyGovernance {
    if (_liquidity == address(0) || _oracle == address(0)) revert ZeroAddress();
    oracle[_liquidity] = _oracle;
    emit OracleSet(_liquidity, _oracle);
  }

  /// @inheritdoc IKeep3rHelperSidechain
  function quoteUsdToEth(uint256 _usd) public view override returns (uint256 _amountOut) {
    uint32[] memory _secondsAgos = new uint32[](2);
    _secondsAgos[1] = quoteTwapTime;

    /// @dev Oracle is compatible with IUniswapV3Pool
    (int56[] memory _tickCumulatives, ) = IUniswapV3Pool(wethUSDPool.poolAddress).observe(_secondsAgos);
    int56 _difference = _tickCumulatives[0] - _tickCumulatives[1];
    _amountOut = getQuoteAtTick(uint128(_usd), wethUSDPool.isTKNToken0 ? _difference : -_difference, quoteTwapTime);
  }

  /// @inheritdoc IKeep3rHelperSidechain
  function setWethUsdPool(address _poolAddress) external override onlyGovernance {
    if (_poolAddress == address(0)) revert ZeroAddress();
    _setWethUsdPool(_poolAddress);
  }

  function _setWethUsdPool(address _poolAddress) internal {
    wethUSDPool = _validateOraclePool(_poolAddress, WETH);
    emit WethUSDPoolChange(wethUSDPool.poolAddress, wethUSDPool.isTKNToken0);
  }

  /// @dev Sidechain jobs are quoted by USD/gasUnit, baseFee is set to 1
  function _getBasefee() internal view virtual override returns (uint256 _baseFee) {
    return 1;
  }
}
