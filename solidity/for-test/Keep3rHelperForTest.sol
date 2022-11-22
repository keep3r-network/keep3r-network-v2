// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/Keep3rHelper.sol';

contract Keep3rHelperForTest is Keep3rHelper {
  uint256 public basefee;

  constructor(
    address _kp3r,
    address _keep3rV2,
    address _governance,
    address _kp3rWethPool
  ) Keep3rHelper(_kp3r, _keep3rV2, _governance, _kp3rWethPool) {}

  function _getBasefee() internal view override returns (uint256) {
    return basefee != 0 ? (basefee + minPriorityFee) : super._getBasefee();
  }

  function setBaseFee(uint256 _baseFee) external {
    basefee = _baseFee;
  }
}
