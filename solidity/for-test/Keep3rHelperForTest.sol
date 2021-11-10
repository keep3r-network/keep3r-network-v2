// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '../contracts/Keep3rHelper.sol';

contract Keep3rHelperForTest is Keep3rHelper {
  uint256 public basefee;

  constructor(address _keep3rV2) Keep3rHelper(_keep3rV2) {}

  function _getBasefee() internal view override returns (uint256) {
    return basefee;
  }
}
