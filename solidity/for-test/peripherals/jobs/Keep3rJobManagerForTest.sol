// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../contracts/peripherals/jobs/Keep3rJobManager.sol';

contract Keep3rJobManagerForTest is Keep3rJobManager {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3rParameters(_keep3rHelper, _keep3rV1, _keep3rV1Proxy) Keep3rRoles(msg.sender) {}

  function isJob(address _job) external view returns (bool _isJob) {
    _isJob = _jobs.contains(_job);
  }
}
