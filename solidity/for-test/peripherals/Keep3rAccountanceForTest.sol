// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/peripherals/Keep3rAccountance.sol';

contract Keep3rAccountanceForTest is Keep3rAccountance {
  using EnumerableSet for EnumerableSet.AddressSet;

  function setJob(address job) external {
    _jobs.add(job);
  }

  function setKeeper(address keeper) external {
    _keepers.add(keeper);
  }
}
