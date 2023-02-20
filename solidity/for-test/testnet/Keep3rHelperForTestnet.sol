// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/Keep3rHelper.sol';

contract Keep3rHelperForTestnet is Keep3rHelper {
  constructor(
    address _kp3r,
    address _keep3rV2,
    address _governor,
    address _kp3rWethPool
  ) Keep3rHelper(_kp3r, _keep3rV2, _governor, _kp3rWethPool) {}

  function _getBasefee() internal pure override returns (uint256) {
    return 1;
  }
}
