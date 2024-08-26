// SPDX-License-Identifier: MIT

/*

Coded for The Keep3r Network with ♥ by

██████╗░███████╗███████╗██╗░░░██╗░░░░░░░██╗░█████╗░███╗░░██╗██████╗░███████╗██████╗░██╗░░░░░░█████╗░███╗░░██╗██████╗░
██╔══██╗██╔════╝██╔════╝██║░░░██║░░██╗░░██║██╔══██╗████╗░██║██╔══██╗██╔════╝██╔══██╗██║░░░░░██╔══██╗████╗░██║██╔══██╗
██║░░██║█████╗░░█████╗░░██║░░░╚██╗████╗██╔╝██║░░██║██╔██╗██║██║░░██║█████╗░░██████╔╝██║░░░░░███████║██╔██╗██║██║░░██║
██║░░██║██╔══╝░░██╔══╝░░██║░░░░████╔═████║░██║░░██║██║╚████║██║░░██║██╔══╝░░██╔══██╗██║░░░░░██╔══██║██║╚████║██║░░██║
██████╔╝███████╗██║░░░░░██║░░░░╚██╔╝░╚██╔╝░╚█████╔╝██║░╚███║██████╔╝███████╗██║░░██║███████╗██║░░██║██║░╚███║██████╔╝
╚═════╝░╚══════╝╚═╝░░░░░╚═╝░░░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚══╝╚═════╝░╚══════╝╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝╚═╝░░╚══╝╚═════╝░

https://defi.sucks

Commit hash: b18e2940310077e04ec08b3026dc92e441fb08ef

*/

pragma solidity >=0.8.4 <0.9.0;

import '../Keep3rHelper.sol';
import '../../interfaces/sidechain/IKeep3rHelperSidechain.sol';

contract Keep3rHelperSidechain is IKeep3rHelperSidechain, Keep3rHelper {
  /// @inheritdoc IKeep3rHelperSidechain
  mapping(address => address) public override oracle;
  /// @inheritdoc IKeep3rHelperSidechain
  IKeep3rHelperSidechain.WethUsdOraclePool public override wethUSDPool;

  /// @notice Ethereum mainnet WETH address used for quoting references
  address public immutable override WETH;

  /// @dev Amount of decimals in which USD is quoted within the contract
  uint256 constant _USD_BASE_DECIMALS = 18;

  /// @param _keep3rV2 Address of sidechain Keep3r implementation
  /// @param _governor Address of governor
  /// @param _kp3rWethOracle Address of oracle used for KP3R/WETH quote
  /// @param _wethUsdOracle Address of oracle used for WETH/USD quote
  /// @dev Oracle pools should use 18 decimals tokens
  constructor(
    address _keep3rV2,
    address _governor,
    address _kp3r,
    address _weth,
    address _kp3rWethOracle,
    address _wethUsdOracle,
    uint8 _usdDecimals
  ) Keep3rHelper(_kp3r, _keep3rV2, _governor, _kp3rWethOracle) {
    WETH = _weth;

    // Immutable variables [KP3R] cannot be read during contract creation time [_setKp3rWethPool]
    bool _isWETHToken0 = _validateOraclePool(_wethUsdOracle, WETH);
    wethUSDPool = WethUsdOraclePool(_wethUsdOracle, _isWETHToken0, _usdDecimals);
    emit WethUSDPoolChange(wethUSDPool.poolAddress, wethUSDPool.isWETHToken0, _usdDecimals);

    _setQuoteTwapTime(1 days);
    workExtraGas = 0;
  }

  /// @inheritdoc IKeep3rHelper
  /// @notice Uses valid wKP3R address from Keep3rSidechain to query keeper bonds
  function bonds(address _keeper) public view override(Keep3rHelper, IKeep3rHelper) returns (uint256 _amountBonded) {
    address wKP3R = IKeep3r(keep3rV2).keep3rV1();
    return IKeep3r(keep3rV2).bonds(_keeper, wKP3R);
  }

  /// @inheritdoc IKeep3rHelperSidechain
  function setOracle(address _liquidity, address _oracle) external override onlyGovernor {
    if (_liquidity == address(0) || _oracle == address(0)) revert ZeroAddress();
    oracle[_liquidity] = _oracle;
    emit OracleSet(_liquidity, _oracle);
  }

  /// @inheritdoc IKeep3rHelperSidechain
  function quoteUsdToEth(uint256 _usd) public view virtual override returns (uint256 _amountOut) {
    uint32[] memory _secondsAgos = new uint32[](2);
    _secondsAgos[1] = quoteTwapTime;
    _usd = _usd / 10**(_USD_BASE_DECIMALS - wethUSDPool.usdDecimals);

    /// @dev Oracle is compatible with IUniswapV3Pool
    (int56[] memory _tickCumulatives, ) = IUniswapV3Pool(wethUSDPool.poolAddress).observe(_secondsAgos);
    int56 _difference = _tickCumulatives[0] - _tickCumulatives[1];
    _amountOut = getQuoteAtTick(uint128(_usd), wethUSDPool.isWETHToken0 ? _difference : -_difference, quoteTwapTime);
  }

  /// @inheritdoc IKeep3rHelperSidechain
  function setWethUsdPool(address _poolAddress, uint8 _usdDecimals) external override onlyGovernor {
    if (_poolAddress == address(0)) revert ZeroAddress();
    _setWethUsdPool(_poolAddress, _usdDecimals);
  }

  /// @inheritdoc IKeep3rHelper
  function getPaymentParams(uint256 _bonds)
    external
    view
    virtual
    override(Keep3rHelper, IKeep3rHelper)
    returns (
      uint256 _boost,
      uint256 _oneUsdQuote,
      uint256 _extraGas
    )
  {
    _oneUsdQuote = quote(quoteUsdToEth(1 ether));
    _boost = getRewardBoostFor(_bonds);
    _extraGas = workExtraGas;
  }

  function _setWethUsdPool(address _poolAddress, uint8 _usdDecimals) internal {
    bool _isWETHToken0 = _validateOraclePool(_poolAddress, WETH);
    wethUSDPool = WethUsdOraclePool(_poolAddress, _isWETHToken0, _usdDecimals);
    emit WethUSDPoolChange(wethUSDPool.poolAddress, wethUSDPool.isWETHToken0, _usdDecimals);
  }

  /// @dev Sidechain jobs are quoted by USD/gasUnit, baseFee is set to 1
  function _getBasefee() internal view virtual override returns (uint256 _baseFee) {
    return 1;
  }
}
