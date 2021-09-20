// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../Keep3r.sol';

contract Keep3rForTest is Keep3r {
  constructor(
    address _governance,
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy,
    address _kp3rWethPool
  ) Keep3r(_governance, _keep3rHelper, _keep3rV1, _keep3rV1Proxy, _kp3rWethPool) {}

  function viewTickOrder(address _liquidity) external view returns (bool) {
    return _isKP3RToken0[_liquidity];
  }
}
