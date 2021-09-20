// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../peripherals/jobs/Keep3rJobFundableCredits.sol';

contract Keep3rJobFundableCreditsForTest is Keep3rJobFundableCredits {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _kph,
    address _keep3rV1,
    address _keep3rV1Proxy,
    address _kp3rWethPool
  ) Keep3rParameters(_kph, _keep3rV1, _keep3rV1Proxy, _kp3rWethPool) Keep3rRoles(msg.sender) {}

  function setJob(address _job, address _jobOwner) external {
    _jobs.add(_job);
    jobOwner[_job] = _jobOwner;
  }

  function setJobToken(address _job, address _token) external {
    _jobTokens[_job].add(_token);
  }

  function isJobToken(address _job, address _token) external view returns (bool _contains) {
    _contains = _jobTokens[_job].contains(_token);
  }
}
