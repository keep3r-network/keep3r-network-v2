// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../../peripherals/jobs/Keep3rJobFundableLiquidity.sol';

contract Keep3rJobFundableLiquidityForTest is Keep3rJobFundableLiquidity {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _kph,
    address _keep3rV1,
    address _keep3rV1Proxy,
    address _kp3rWethPool
  ) Keep3rParameters(_kph, _keep3rV1, _keep3rV1Proxy, _kp3rWethPool) Keep3rRoles(msg.sender) {}

  function setJob(address _job) external {
    _jobs.add(_job);
  }

  function setJobLiquidity(address _job, address _liquidity) external returns (bool) {
    return _jobLiquidities[_job].add(_liquidity);
  }

  function setRevokedLiquidity(address _liquidity) external {
    _approvedLiquidities.remove(_liquidity);
  }

  function viewTickCache(address _liquidity) external view returns (TickCache memory _tickCache) {
    _tickCache = _tick[_liquidity];
  }

  function internalJobLiquidities(address _job) external view returns (address[] memory _list) {
    _list = _jobLiquidities[_job].values();
  }

  function internalSettleJobAccountance(address _job) external {
    _settleJobAccountance(_job);
  }

  function viewTickOrder(address _liquidity) external view returns (bool) {
    return _isKP3RToken0[_liquidity];
  }
}
