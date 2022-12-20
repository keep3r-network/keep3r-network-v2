// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../contracts/peripherals/jobs/Keep3rJobWorkable.sol';

contract Keep3rJobWorkableForTest is Keep3rJobWorkable {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3rParameters(_keep3rHelper, _keep3rV1, _keep3rV1Proxy) Keep3rRoles(msg.sender) {}

  function setJob(address _job) external {
    _jobs.add(_job);
  }

  function setKeeper(address _keeper) external {
    _keepers.add(_keeper);
  }

  function setApprovedLiquidity(address _liquidity) external {
    _approvedLiquidities.add(_liquidity);
  }

  function setJobLiquidity(address _job, address _liquidity) external {
    _jobLiquidities[_job].add(_liquidity);
  }

  function viewJobLiquidityCredits(address _job) external view returns (uint256) {
    return _jobLiquidityCredits[_job];
  }

  function viewJobPeriodCredits(address _job) external view returns (uint256) {
    return _jobPeriodCredits[_job];
  }

  function viewTickCache(address _liquidity) external view returns (TickCache memory _tickCache) {
    _tickCache = _tick[_liquidity];
  }

  function viewGas() external view returns (uint256) {
    return _initialGas;
  }
}
