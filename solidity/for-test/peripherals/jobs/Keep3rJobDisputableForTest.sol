// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../contracts/peripherals/jobs/Keep3rJobDisputable.sol';

contract Keep3rJobDisputableForTest is Keep3rJobDisputable {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _kph,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3rParameters(_kph, _keep3rV1, _keep3rV1Proxy) Keep3rRoles(msg.sender) {}

  function setJobLiquidity(address _job, address _liquidity) external {
    _jobLiquidities[_job].add(_liquidity);
  }

  function setJobToken(address _job, address _token) external {
    _jobTokens[_job].add(_token);
  }

  function setApprovedLiquidity(address _liquidity) external {
    _approvedLiquidities.add(_liquidity);
  }

  function setRevokedLiquidity(address _liquidity) external {
    _approvedLiquidities.remove(_liquidity);
  }

  function internalJobLiquidityCredits(address _job) external view returns (uint256 _credits) {
    _credits = _jobLiquidityCredits[_job];
  }

  function internalJobPeriodCredits(address _job) external view returns (uint256 _credits) {
    _credits = _jobPeriodCredits[_job];
  }

  function internalJobTokens(address _job) external view returns (address[] memory _tokens) {
    _tokens = new address[](_jobTokens[_job].length());
    for (uint256 i; i < _jobTokens[_job].length(); i++) {
      _tokens[i] = _jobTokens[_job].at(i);
    }
  }

  function internalJobLiquidities(address _job) external view returns (address[] memory _tokens) {
    _tokens = new address[](_jobLiquidities[_job].length());
    for (uint256 i; i < _jobLiquidities[_job].length(); i++) {
      _tokens[i] = _jobLiquidities[_job].at(i);
    }
  }
}
