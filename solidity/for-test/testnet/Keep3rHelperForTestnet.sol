// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/Keep3rHelper.sol';

contract Keep3rHelperForTestnet is Keep3rHelper {
  constructor(
    address _kp3r,
    address _keep3rV2,
    address _governance,
    address _kp3rWethPool
  ) Keep3rHelper(_kp3r, _keep3rV2, _governance, _kp3rWethPool) {}

  function _getBasefee() internal view override returns (uint256) {
    return 1;
  }

  /// @dev Overrides oracle validation that uses KP3R and WETH addresses
  function _validateOraclePool(address _poolAddress, address) internal view virtual override returns (TokenOraclePool memory _oraclePool) {
    return TokenOraclePool(_poolAddress, true);
  }

  /// @dev Overrides token comparison with KP3R address
  function isKP3RToken0(address) public view virtual override returns (bool) {
    return true;
  }
}
