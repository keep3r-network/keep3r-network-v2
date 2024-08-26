// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../interfaces/IKeep3rHelper.sol';
import '../../interfaces/peripherals/IKeep3rParameters.sol';
import '../../interfaces/external/IKeep3rV1Proxy.sol';
import './Keep3rAccountance.sol';

abstract contract Keep3rParameters is IKeep3rParameters, Keep3rAccountance {
  /// @inheritdoc IKeep3rParameters
  address public override keep3rV1;

  /// @inheritdoc IKeep3rParameters
  address public override keep3rV1Proxy;

  /// @inheritdoc IKeep3rParameters
  address public override keep3rHelper;

  /// @inheritdoc IKeep3rParameters
  uint256 public override bondTime = 3 days;

  /// @inheritdoc IKeep3rParameters
  uint256 public override unbondTime = 14 days;

  /// @inheritdoc IKeep3rParameters
  uint256 public override liquidityMinimum = 3 ether;

  /// @inheritdoc IKeep3rParameters
  uint256 public override rewardPeriodTime = 5 days;

  /// @inheritdoc IKeep3rParameters
  uint256 public override inflationPeriod = 34 days;

  /// @inheritdoc IKeep3rParameters
  uint256 public override fee = 30;

  /// @notice The base that will be used to calculate the fee
  uint256 internal constant _BASE = 10_000;

  /// @notice The minimum reward period
  uint256 internal constant _MIN_REWARD_PERIOD_TIME = 1 days;

  constructor(
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) {
    keep3rHelper = _keep3rHelper;
    keep3rV1 = _keep3rV1;
    keep3rV1Proxy = _keep3rV1Proxy;
  }

  /// @inheritdoc IKeep3rParameters
  function setKeep3rHelper(address _keep3rHelper) external override onlyGovernor {
    if (_keep3rHelper == address(0)) revert ZeroAddress();
    keep3rHelper = _keep3rHelper;
    emit Keep3rHelperChange(_keep3rHelper);
  }

  /// @inheritdoc IKeep3rParameters
  function setKeep3rV1(address _keep3rV1) public virtual override onlyGovernor {
    if (_keep3rV1 == address(0)) revert ZeroAddress();
    _mint(totalBonds);

    keep3rV1 = _keep3rV1;
    emit Keep3rV1Change(_keep3rV1);
  }

  /// @inheritdoc IKeep3rParameters
  function setKeep3rV1Proxy(address _keep3rV1Proxy) external override onlyGovernor {
    if (_keep3rV1Proxy == address(0)) revert ZeroAddress();
    keep3rV1Proxy = _keep3rV1Proxy;
    emit Keep3rV1ProxyChange(_keep3rV1Proxy);
  }

  /// @inheritdoc IKeep3rParameters
  function setBondTime(uint256 _bondTime) external override onlyGovernor {
    bondTime = _bondTime;
    emit BondTimeChange(_bondTime);
  }

  /// @inheritdoc IKeep3rParameters
  function setUnbondTime(uint256 _unbondTime) external override onlyGovernor {
    unbondTime = _unbondTime;
    emit UnbondTimeChange(_unbondTime);
  }

  /// @inheritdoc IKeep3rParameters
  function setLiquidityMinimum(uint256 _liquidityMinimum) external override onlyGovernor {
    liquidityMinimum = _liquidityMinimum;
    emit LiquidityMinimumChange(_liquidityMinimum);
  }

  /// @inheritdoc IKeep3rParameters
  function setRewardPeriodTime(uint256 _rewardPeriodTime) external override onlyGovernor {
    if (_rewardPeriodTime < _MIN_REWARD_PERIOD_TIME) revert MinRewardPeriod();
    rewardPeriodTime = _rewardPeriodTime;
    emit RewardPeriodTimeChange(_rewardPeriodTime);
  }

  /// @inheritdoc IKeep3rParameters
  function setInflationPeriod(uint256 _inflationPeriod) external override onlyGovernor {
    inflationPeriod = _inflationPeriod;
    emit InflationPeriodChange(_inflationPeriod);
  }

  /// @inheritdoc IKeep3rParameters
  function setFee(uint256 _fee) external override onlyGovernor {
    fee = _fee;
    emit FeeChange(_fee);
  }

  function _mint(uint256 _amount) internal {
    totalBonds -= _amount;
    IKeep3rV1Proxy(keep3rV1Proxy).mint(_amount);
  }
}
