// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/sidechain/Keep3rHelperSidechain.sol';

contract Keep3rHelperSidechainForTestnet is Keep3rHelperSidechain {
  constructor(
    address _keep3rV2,
    address _governance,
    address _kp3r,
    address _weth,
    address _kp3rWethOracle,
    address _wethUsdOracle
  ) Keep3rHelperSidechain(_keep3rV2, _governance, _kp3r, _weth, _kp3rWethOracle, _wethUsdOracle) {}

  /// @dev Overrides oracle validation that uses KP3R and WETH addresses
  function _validateOraclePool(address _poolAddress, address) internal view virtual override returns (TokenOraclePool memory _oraclePool) {
    return TokenOraclePool(_poolAddress, true);
  }

  /// @dev Overrides token comparison with KP3R address
  function isKP3RToken0(address) public view virtual override returns (bool) {
    return true;
  }

  function quoteUsdToEth(uint256 _usd) public view virtual override returns (uint256) {
    return _usd / 1000;
  }
}
