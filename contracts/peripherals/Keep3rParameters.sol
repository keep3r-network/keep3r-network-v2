// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/peripherals/IKeep3rParameters.sol';
import './Keep3rAccountance.sol';
import './Keep3rRoles.sol';

import '../libraries/Keep3rLibrary.sol';

abstract contract Keep3rParameters is IKeep3rParameters, Keep3rAccountance, Keep3rRoles {
  address public override keep3rV1;
  address public override keep3rV1Proxy;
  address public override keep3rHelper;
  address public override kp3rWethPool;

  uint256 public override bondTime = 3 days;
  uint256 public override unbondTime = 14 days;
  uint256 public override liquidityMinimum = 3 ether;
  uint256 public override rewardPeriodTime = 5 days;
  uint256 public override inflationPeriod = 34 days;

  uint256 public constant override FEE = 30;
  uint256 public constant override BASE = 10000;
  uint256 public constant override MIN_REWARD_PERIOD_TIME = 1 days;

  constructor(
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy,
    address _kp3rWethPool
  ) {
    keep3rHelper = _keep3rHelper;
    keep3rV1 = _keep3rV1;
    keep3rV1Proxy = _keep3rV1Proxy;
    kp3rWethPool = _kp3rWethPool;
    _liquidityPool[kp3rWethPool] = kp3rWethPool;
    _isKP3RToken0[_kp3rWethPool] = Keep3rLibrary.isKP3RToken0(keep3rV1, kp3rWethPool);
  }

  function setKeep3rHelper(address _keep3rHelper) external override onlyGovernance {
    if (_keep3rHelper == address(0)) revert ZeroAddress();
    keep3rHelper = _keep3rHelper;
    emit Keep3rHelperChange(_keep3rHelper);
  }

  function setKeep3rV1(address _keep3rV1) external override onlyGovernance {
    if (_keep3rV1 == address(0)) revert ZeroAddress();
    keep3rV1 = _keep3rV1;
    emit Keep3rV1Change(_keep3rV1);
  }

  function setKeep3rV1Proxy(address _keep3rV1Proxy) external override onlyGovernance {
    if (_keep3rV1Proxy == address(0)) revert ZeroAddress();
    keep3rV1Proxy = _keep3rV1Proxy;
    emit Keep3rV1ProxyChange(_keep3rV1Proxy);
  }

  function setkp3rWethPool(address _kp3rWethPool) external override onlyGovernance {
    if (_kp3rWethPool == address(0)) revert ZeroAddress();
    kp3rWethPool = _kp3rWethPool;
    _liquidityPool[kp3rWethPool] = kp3rWethPool;
    _isKP3RToken0[_kp3rWethPool] = Keep3rLibrary.isKP3RToken0(keep3rV1, _kp3rWethPool);
    emit Kp3rWethPoolChange(_kp3rWethPool);
  }

  function setBondTime(uint256 _bondTime) external override onlyGovernance {
    bondTime = _bondTime;
    emit BondTimeChange(_bondTime);
  }

  function setUnbondTime(uint256 _unbondTime) external override onlyGovernance {
    unbondTime = _unbondTime;
    emit UnbondTimeChange(_unbondTime);
  }

  function setLiquidityMinimum(uint256 _liquidityMinimum) external override onlyGovernance {
    liquidityMinimum = _liquidityMinimum;
    emit LiquidityMinimumChange(_liquidityMinimum);
  }

  function setRewardPeriodTime(uint256 _rewardPeriodTime) external override onlyGovernance {
    if (_rewardPeriodTime < MIN_REWARD_PERIOD_TIME) revert MinRewardPeriod();
    rewardPeriodTime = _rewardPeriodTime;
    emit RewardPeriodTimeChange(_rewardPeriodTime);
  }

  function setInflationPeriod(uint256 _inflationPeriod) external override onlyGovernance {
    inflationPeriod = _inflationPeriod;
    emit InflationPeriodChange(_inflationPeriod);
  }
}
