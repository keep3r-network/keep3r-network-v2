// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rJobOwnership.sol';
import '../Keep3rAccountance.sol';
import '../Keep3rParameters.sol';
import '../../interfaces/IUniV3PairManager.sol';
import '../../interfaces/peripherals/IKeep3rJobs.sol';
import '../../interfaces/external/IKeep3rV1.sol';
import '../../interfaces/IKeep3rHelper.sol';

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '../../libraries/Keep3rLibrary.sol';

abstract contract Keep3rJobFundableLiquidity is IKeep3rJobFundableLiquidity, ReentrancyGuard, Keep3rJobOwnership, Keep3rParameters {
  using EnumerableSet for EnumerableSet.AddressSet;
  using SafeERC20 for IERC20;

  /// @notice list of liquidities that are accepted in the system
  EnumerableSet.AddressSet internal _approvedLiquidities;

  /// @notice liquidity amount to apply
  mapping(address => mapping(address => uint256)) public override liquidityAmount;
  /// @notice last time the job was rewarded liquidity credits (job => block.timestamp)
  mapping(address => uint256) public override rewardedAt;
  /// @notice last time the job was worked last (job => block.timestamp)
  mapping(address => uint256) public override workedAt;

  mapping(address => TickCache) internal _tick;

  // Views

  /**
   * @notice Displays all of the approved liquidity pairs
   */
  function approvedLiquidities() external view override returns (address[] memory _list) {
    _list = _approvedLiquidities.values();
  }

  function jobPeriodCredits(address _job) public view override returns (uint256 _periodCredits) {
    for (uint256 i; i < _jobLiquidities[_job].length(); i++) {
      address _liquidity = _jobLiquidities[_job].at(i);
      if (_approvedLiquidities.contains(_liquidity)) {
        TickCache memory _tickCache = observeLiquidity(_liquidity);
        if (_tickCache.period != 0) {
          int56 _tickDifference = _isKP3RToken0[_liquidity] ? _tickCache.difference : -_tickCache.difference;
          _periodCredits += _getReward(Keep3rLibrary.getQuoteAtTick(liquidityAmount[_job][_liquidity], _tickDifference, rewardPeriodTime));
        }
      }
    }
  }

  function jobLiquidityCredits(address _job) public view override returns (uint256 _liquidityCredits) {
    uint256 _periodCredits = jobPeriodCredits(_job);

    // A job can have liquidityCredits without periodCredits (forced by Governance)
    if ((rewardedAt[_job] > _period(block.timestamp - rewardPeriodTime)) && (_periodCredits > 0)) {
      // Will calculate job credits only if it was rewarded later than last period
      if ((block.timestamp - rewardedAt[_job]) >= rewardPeriodTime) {
        // Will return a full period if job was rewarded more than a period ago
        _liquidityCredits = _periodCredits;
      } else {
        // Will update job credits to new twap if credits are outdated
        _liquidityCredits = (_jobLiquidityCredits[_job] * _periodCredits) / _jobPeriodCredits[_job];
      }
    } else {
      // Will return a full period if job credits are expired
      _liquidityCredits = _periodCredits == 0 ? _jobLiquidityCredits[_job] : _periodCredits;
    }
  }

  function totalJobCredits(address _job) external view override returns (uint256 _credits) {
    uint256 _periodCredits = jobPeriodCredits(_job);
    uint256 _cooldown;

    if ((rewardedAt[_job] > _period(block.timestamp - rewardPeriodTime))) {
      // Will calculate cooldown if it outdated
      if ((block.timestamp - rewardedAt[_job]) >= rewardPeriodTime) {
        // Will calculate cooldown from last reward reference in this period
        _cooldown = block.timestamp - (rewardedAt[_job] + rewardPeriodTime);
      } else {
        // Will calculate cooldown from last reward timestamp
        _cooldown = block.timestamp - rewardedAt[_job];
      }
    } else {
      // Will calculate cooldown from period start if expired
      _cooldown = block.timestamp - _period(block.timestamp);
    }
    _credits = jobLiquidityCredits(_job) + _phase(_cooldown, _periodCredits);
  }

  /*
   * @notice Calculates how many credits should be rewarded periodically for a given liquidity amount
   * @param _liquidity The liquidity to provide
   * @param _amount The amount of liquidity to provide
   * @return _periodCredits The amount of KP3R periodically minted for the given liquidity
   * @dev _periodCredits = underlying KP3Rs for given liquidity amount * rewardPeriod / inflationPeriod
   */
  function quoteLiquidity(address _liquidity, uint256 _amount) external view override returns (uint256 _periodCredits) {
    if (_approvedLiquidities.contains(_liquidity)) {
      TickCache memory _tickCache = observeLiquidity(_liquidity);
      if (_tickCache.period != 0) {
        int56 _tickDifference = _isKP3RToken0[_liquidity] ? _tickCache.difference : -_tickCache.difference;
        return _getReward(Keep3rLibrary.getQuoteAtTick(_amount, _tickDifference, rewardPeriodTime));
      }
    }
  }

  function observeLiquidity(address _liquidity) public view override returns (TickCache memory _tickCache) {
    if (_tick[_liquidity].period == _period(block.timestamp)) {
      // Will return cached twaps if liquidity is updated
      _tickCache = _tick[_liquidity];
    } else {
      bool success;
      uint256 lastPeriod = _period(block.timestamp - rewardPeriodTime);

      if (_tick[_liquidity].period == lastPeriod) {
        // Will only ask for current period accumulator if liquidity is outdated
        uint32[] memory _secondsAgo = new uint32[](1);
        int56 previousTick = _tick[_liquidity].current;

        _secondsAgo[0] = uint32(block.timestamp - _period(block.timestamp));

        (_tickCache.current, , success) = Keep3rLibrary.observe(_liquidityPool[_liquidity], _secondsAgo);

        _tickCache.difference = _tickCache.current - previousTick;
      } else if (_tick[_liquidity].period < lastPeriod) {
        // Will ask for 2 accumulators if liquidity is expired
        uint32[] memory _secondsAgo = new uint32[](2);

        _secondsAgo[0] = uint32(block.timestamp - _period(block.timestamp));
        _secondsAgo[1] = uint32(block.timestamp - _period(block.timestamp) + rewardPeriodTime);

        int56 _tickCumulative2;
        (_tickCache.current, _tickCumulative2, success) = Keep3rLibrary.observe(_liquidityPool[_liquidity], _secondsAgo);

        _tickCache.difference = _tickCache.current - _tickCumulative2;
      }
      if (success) {
        _tickCache.period = _period(block.timestamp);
      } else {
        _tickCache.period = 0;
      }
    }
  }

  // Methods

  /**
   * @notice Force liquidity credits to a job to be paid out for work
   * @param _job the job being credited
   * @param _amount the amount of credit being added to the job
   */
  function forceLiquidityCreditsToJob(address _job, uint256 _amount) external override onlyGovernance {
    if (!_jobs.contains(_job)) revert JobUnavailable();
    _settleJobAccountance(_job);
    _jobLiquidityCredits[_job] += _amount;
    emit JobCreditsUpdated(_job, rewardedAt[_job], _jobLiquidityCredits[_job]);
  }

  /**
   * @notice Approve a liquidity pair for being accepted in future
   * @param _liquidity the liquidity no longer accepted
   */
  function approveLiquidity(address _liquidity) external override onlyGovernance {
    if (!_approvedLiquidities.add(_liquidity)) revert LiquidityPairApproved();
    _liquidityPool[_liquidity] = IPairManager(_liquidity).pool();
    _isKP3RToken0[_liquidity] = Keep3rLibrary.isKP3RToken0(keep3rV1, _liquidityPool[_liquidity]);
    emit LiquidityApproval(_liquidity);
  }

  /**
   * @notice Revoke a liquidity pair from being accepted in future
   * @param _liquidity the liquidity no longer accepted
   */
  function revokeLiquidity(address _liquidity) external override onlyGovernance {
    if (!_approvedLiquidities.remove(_liquidity)) revert LiquidityPairUnexistent();
    emit LiquidityRevocation(_liquidity);
  }

  /**
   * @notice Allows anyone to fund a job with liquidity
   * @param _job the job to assign liquidity to
   * @param _liquidity the liquidity being added
   * @param _amount the amount of liquidity tokens to add
   */
  function addLiquidityToJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external override nonReentrant {
    if (!_approvedLiquidities.contains(_liquidity)) revert LiquidityPairUnapproved();
    if (!_jobs.contains(_job)) revert JobUnavailable();

    _jobLiquidities[_job].add(_liquidity);

    // addLiquidityToJob can be the first interaction with job
    if (rewardedAt[_job] == 0) {
      rewardedAt[_job] = block.timestamp;
      if (_tick[_liquidity].period < _period(block.timestamp)) {
        _tick[_liquidity] = observeLiquidity(_liquidity);
      }
    } else {
      _settleJobAccountance(_job);
    }

    if (_quoteLiquidity(liquidityAmount[_job][_liquidity] + _amount, _liquidity) < liquidityMinimum) revert JobLiquidityLessThanMin();

    emit JobCreditsUpdated(_job, rewardedAt[_job], _jobLiquidityCredits[_job]);

    IERC20(_liquidity).safeTransferFrom(msg.sender, address(this), _amount);
    liquidityAmount[_job][_liquidity] += _amount;
    _jobPeriodCredits[_job] += _getReward(_quoteLiquidity(_amount, _liquidity));
    emit LiquidityAddition(_job, _liquidity, msg.sender, block.timestamp, _amount);
  }

  /**
   * @notice Unbond liquidity for a job
   * @param _job the job being unbound from
   * @param _liquidity the liquidity being unbound
   * @param _amount the amount of liquidity being removed
   */
  function unbondLiquidityFromJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external override onlyJobOwner(_job) {
    canWithdrawAfter[_job][_liquidity] = block.timestamp + unbondTime;
    pendingUnbonds[_job][_liquidity] += _amount;
    _unbondLiquidityFromJob(_job, _liquidity, _amount);

    uint256 _remainingLiquidity = liquidityAmount[_job][_liquidity];
    if (_remainingLiquidity > 0 && _quoteLiquidity(_remainingLiquidity, _liquidity) < liquidityMinimum) revert JobLiquidityLessThanMin();

    emit Unbonding(_job, block.number, canWithdrawAfter[_job][_liquidity], _amount);
  }

  /**
   * @notice Withdraw liquidity from a job
   * @param _job the job being withdrawn from
   * @param _liquidity the liquidity being withdrawn
   */
  function withdrawLiquidityFromJob(address _job, address _liquidity) external override onlyJobOwner(_job) {
    if (canWithdrawAfter[_job][_liquidity] == 0) revert UnbondsUnexistent();
    if (canWithdrawAfter[_job][_liquidity] >= block.timestamp) revert UnbondsLocked();
    if (disputes[_job]) revert Disputed();

    uint256 _amount = pendingUnbonds[_job][_liquidity];
    IERC20(_liquidity).safeTransfer(msg.sender, _amount);
    emit LiquidityWithdrawal(_job, _liquidity, msg.sender, block.timestamp, _amount);

    pendingUnbonds[_job][_liquidity] = 0;
  }

  // Internal functions
  function _updateJobCreditsIfNeeded(address _job) internal returns (bool _rewarded) {
    if (rewardedAt[_job] < _period(block.timestamp)) {
      // Will exit function if job has been rewarded in current period
      if (rewardedAt[_job] <= _period(block.timestamp - rewardPeriodTime)) {
        // Will reset job to period syncronicity if a full period passed without rewards
        _updateJobPeriod(_job);
        _jobLiquidityCredits[_job] = _jobPeriodCredits[_job];
        rewardedAt[_job] = _period(block.timestamp);
        _rewarded = true;
      } else if ((block.timestamp - rewardedAt[_job]) >= rewardPeriodTime) {
        // Will reset job's syncronicity if last reward was more than epoch ago
        _updateJobPeriod(_job);
        _jobLiquidityCredits[_job] = _jobPeriodCredits[_job];
        rewardedAt[_job] += rewardPeriodTime;
        _rewarded = true;
      } else if (workedAt[_job] < _period(block.timestamp)) {
        // First keeper on period has to update job accountance to current twaps
        uint256 previousPeriodCredits = _jobPeriodCredits[_job];
        _updateJobPeriod(_job);
        _jobLiquidityCredits[_job] = (_jobLiquidityCredits[_job] * _jobPeriodCredits[_job]) / previousPeriodCredits;
        // Updating job accountance does not reward job
      }
    }
  }

  /// @notice only called if _jobLiquidityCredits < payment
  function _rewardJobCredits(address _job) internal {
    /// @notice only way to += jobLiquidityCredits is when keeper rewarding (cannot pay work)
    /* WARNING: this allows to top up _jobLiquidityCredits to a max of 1.99 but have to spend at least 1*/
    _jobLiquidityCredits[_job] += _phase(block.timestamp - rewardedAt[_job], _jobPeriodCredits[_job]);
    rewardedAt[_job] = block.timestamp;
  }

  function _updateJobPeriod(address _job) internal {
    _jobPeriodCredits[_job] = _calculateJobPeriodCredits(_job);
  }

  function _calculateJobPeriodCredits(address _job) internal returns (uint256 _periodCredits) {
    if (_tick[kp3rWethPool].period != _period(block.timestamp)) {
      // Updates KP3R/WETH quote if needed
      _tick[kp3rWethPool] = observeLiquidity(kp3rWethPool);
    }

    for (uint256 i; i < _jobLiquidities[_job].length(); i++) {
      address _liquidity = _jobLiquidities[_job].at(i);
      if (_approvedLiquidities.contains(_liquidity)) {
        if (_tick[_liquidity].period != _period(block.timestamp)) {
          // Updates liquidity cache only if needed
          _tick[_liquidity] = observeLiquidity(_liquidity);
        }
        _periodCredits += _getReward(_quoteLiquidity(liquidityAmount[_job][_liquidity], _liquidity));
      }
    }
  }

  /**
   * @notice Withdraw liquidity from a job
   * @param _job the job being withdrawn from
   * @param _liquidity the pair being withdrawn
   * @param _amount the amount of liquidity being withdrawn
   */
  function _unbondLiquidityFromJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) internal nonReentrant {
    if (!_jobLiquidities[_job].contains(_liquidity)) revert JobLiquidityUnexistent();
    if (liquidityAmount[_job][_liquidity] < _amount) revert JobLiquidityInsufficient();

    // ensures current twaps in job liquidities
    _updateJobPeriod(_job);
    uint256 _periodCreditsToRemove = _getReward(_quoteLiquidity(_amount, _liquidity));

    // A liquidity can be revoked causing a job to have 0 periodCredits
    if (_jobPeriodCredits[_job] > 0) {
      // Removes a % correspondant to a full rewardPeriodTime for the liquidity withdrawn vs all of the liquidities
      _jobLiquidityCredits[_job] -= (_jobLiquidityCredits[_job] * _periodCreditsToRemove) / _jobPeriodCredits[_job];
      _jobPeriodCredits[_job] -= _periodCreditsToRemove;
    }

    liquidityAmount[_job][_liquidity] -= _amount;
    if (liquidityAmount[_job][_liquidity] == 0) {
      _jobLiquidities[_job].remove(_liquidity);
    }
  }

  /// @notice Returns a fraction of the multiplier or the whole multiplier if equal or more than a rewardPeriodTime has passed
  function _phase(uint256 _timePassed, uint256 _multiplier) internal view returns (uint256 _result) {
    if (_timePassed < rewardPeriodTime) {
      _result = ((_timePassed % rewardPeriodTime) * _multiplier) / rewardPeriodTime;
    } else _result = _multiplier;
  }

  /// @notice returns the start of the period of the provided timestamp
  function _period(uint256 _timestamp) internal view returns (uint256) {
    return _timestamp - (_timestamp % rewardPeriodTime);
  }

  function _getReward(uint256 _baseAmount) internal view returns (uint256 _credits) {
    return Keep3rLibrary.mulDiv(_baseAmount, rewardPeriodTime, inflationPeriod);
  }

  function _quoteLiquidity(uint256 _amount, address _liquidity) internal view returns (uint256 _quote) {
    if (_tick[_liquidity].period != 0) {
      int56 _tickDifference = _isKP3RToken0[_liquidity] ? _tick[_liquidity].difference : -_tick[_liquidity].difference;
      _quote = Keep3rLibrary.getQuoteAtTick(_amount, _tickDifference, rewardPeriodTime);
    }
  }

  function _settleJobAccountance(address _job) internal virtual {
    // Updates job credits to current quotes
    _updateJobCreditsIfNeeded(_job);
    // Rewards all pending credits to job
    _rewardJobCredits(_job);
    // Ensures a maximum of 1 period of credits
    _jobLiquidityCredits[_job] = Math.min(_jobLiquidityCredits[_job], _jobPeriodCredits[_job]);
  }
}
