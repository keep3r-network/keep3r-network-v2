// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../peripherals/Keep3rParameters.sol';

contract Keep3rParametersForTest is Keep3rParameters {
  constructor(
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy,
    address _kp3rWethPool
  ) Keep3rParameters(_keep3rHelper, _keep3rV1, _keep3rV1Proxy, _kp3rWethPool) Keep3rRoles(msg.sender) {}
}
