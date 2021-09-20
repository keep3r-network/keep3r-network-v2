// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../peripherals/Keep3rDisputable.sol';

contract Keep3rDisputableForTest is Keep3rDisputable {
  constructor() Keep3rRoles(msg.sender) {}
}
