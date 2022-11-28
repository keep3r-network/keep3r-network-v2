// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/peripherals/Keep3rDisputable.sol';

contract Keep3rDisputableForTest is Keep3rDisputable {
  constructor() Keep3rParameters(address(0), address(0), address(0)) Keep3rRoles(msg.sender) {}
}
