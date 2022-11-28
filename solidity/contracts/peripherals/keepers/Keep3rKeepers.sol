// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../interfaces/peripherals/IKeep3rKeepers.sol';
import './Keep3rKeeperDisputable.sol';

abstract contract Keep3rKeepers is IKeep3rKeepers, Keep3rKeeperDisputable {}
