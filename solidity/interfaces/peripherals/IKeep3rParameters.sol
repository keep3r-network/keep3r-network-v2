// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rParameters {
  // events
  event Keep3rHelperChange(address _keep3rHelper);
  event Keep3rV1Change(address _keep3rV1);
  event Keep3rV1ProxyChange(address _keep3rV1Proxy);
  event Kp3rWethPoolChange(address _kp3rWethPool);
  event BondTimeChange(uint256 _bondTime);
  event LiquidityMinimumChange(uint256 _liquidityMinimum);
  event UnbondTimeChange(uint256 _unbondTime);
  event RewardPeriodTimeChange(uint256 _rewardPeriodTime);
  event Bonding(address indexed _from, uint256 _block, uint256 _active, uint256 _bond);
  event Activation(address indexed _from, uint256 _block, uint256 _activated, uint256 _bond);
  event Unbonding(address indexed _from, uint256 _block, uint256 _deactive, uint256 _bond);
  event Withdrawal(address indexed _from, address _bond, uint256 _amount);
  event InflationPeriodChange(uint256 _inflationPeriod);

  // variables
  function keep3rHelper() external view returns (address);

  function keep3rV1() external view returns (address _keep3rV1);

  function keep3rV1Proxy() external view returns (address _keep3rV1Proxy);

  function kp3rWethPool() external view returns (address _kp3rWethPool);

  function bondTime() external view returns (uint256);

  function unbondTime() external view returns (uint256);

  function liquidityMinimum() external view returns (uint256);

  function rewardPeriodTime() external view returns (uint256);

  function inflationPeriod() external view returns (uint256);

  // solhint-disable func-name-mixedcase
  function FEE() external view returns (uint256);

  function BASE() external view returns (uint256);

  function MIN_REWARD_PERIOD_TIME() external view returns (uint256);

  // solhint-enable func-name-mixedcase

  // errors
  error ZeroAddress();
  error MinRewardPeriod();
  error Disputed();
  error BondsUnexistent();
  error BondsLocked();
  error UnbondsUnexistent();
  error UnbondsLocked();

  // functions
  function setKeep3rHelper(address _keep3rHelper) external;

  function setKeep3rV1(address _keep3rV1) external;

  function setKeep3rV1Proxy(address _keep3rV1Proxy) external;

  function setkp3rWethPool(address _kp3rWethPool) external;

  function setBondTime(uint256 _bond) external;

  function setUnbondTime(uint256 _unbond) external;

  function setLiquidityMinimum(uint256 _liquidityMinimum) external;

  function setRewardPeriodTime(uint256 _rewardPeriodTime) external;

  function setInflationPeriod(uint256 _inflationPeriod) external;
}
