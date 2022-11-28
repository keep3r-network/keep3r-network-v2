// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../interfaces/peripherals/IKeep3rJobs.sol';
import './Keep3rJobManager.sol';
import './Keep3rJobWorkable.sol';
import './Keep3rJobDisputable.sol';

abstract contract Keep3rJobs is IKeep3rJobs, Keep3rJobManager, Keep3rJobWorkable, Keep3rJobDisputable {}
