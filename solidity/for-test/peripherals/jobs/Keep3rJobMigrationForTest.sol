// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../contracts/peripherals/jobs/Keep3rJobMigration.sol';

contract Keep3rJobMigrationForTest is Keep3rJobMigration {
  using EnumerableSet for EnumerableSet.AddressSet;

  mapping(address => uint256) public settleJobAccountanceCallCount;

  constructor(
    address _kph,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3rParameters(_kph, _keep3rV1, _keep3rV1Proxy) Keep3rRoles(msg.sender) {}

  function setJobToken(address _job, address _token) external {
    _jobTokens[_job].add(_token);
  }

  function setJobLiquidity(address _job, address _liquidity) external {
    _jobLiquidities[_job].add(_liquidity);
  }

  function viewJobTokenListLength(address _job) external view returns (uint256) {
    return _jobTokens[_job].length();
  }

  function viewJobLiquidityList(address _job) external view returns (address[] memory _list) {
    _list = _jobLiquidities[_job].values();
  }

  function viewJobPeriodCredits(address _job) external view returns (uint256) {
    return _jobPeriodCredits[_job];
  }

  function viewJobLiquidityCredits(address _job) external view returns (uint256) {
    return _jobLiquidityCredits[_job];
  }

  function viewMigrationCreatedAt(address _fromJob, address _toJob) external view returns (uint256) {
    return _migrationCreatedAt[_fromJob][_toJob];
  }

  function isJob(address _job) external view returns (bool) {
    return _jobs.contains(_job);
  }

  function _settleJobAccountance(address _job) internal override {
    settleJobAccountanceCallCount[_job]++;
  }
}
