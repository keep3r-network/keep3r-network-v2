// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../contracts/peripherals/keepers/Keep3rKeeperFundable.sol';

contract Keep3rKeeperFundableForTest is Keep3rKeeperFundable {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _kph,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3rParameters(_kph, _keep3rV1, _keep3rV1Proxy) Keep3rRoles(msg.sender) {}

  function isKeeper(address _keeper) external view returns (bool) {
    return _keepers.contains(_keeper);
  }

  function setJob(address job) external {
    _jobs.add(job);
  }
}
