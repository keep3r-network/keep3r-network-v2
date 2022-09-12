// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../Keep3r.sol';
import '../../interfaces/sidechain/IKeep3rEscrow.sol';
import '../../interfaces/sidechain/IKeep3rHelperSidechain.sol';
import '../../interfaces/sidechain/IKeep3rJobWorkableRated.sol';

contract Keep3rSidechain is Keep3r, IKeep3rJobWorkableRated {
  using EnumerableSet for EnumerableSet.AddressSet;

  /// @param _governance Address of governance
  /// @param _keep3rHelperSidechain Address of sidechain Keep3rHelper
  /// @param _wrappedKP3R Address of wrapped KP3R implementation
  /// @param _keep3rEscrow Address of sidechain Keep3rEscrow
  constructor(
    address _governance, // governance
    address _keep3rHelperSidechain, // helper
    address _wrappedKP3R, // keep3rV1
    address _keep3rEscrow // keep3rV1Proxy
  ) Keep3r(_governance, _keep3rHelperSidechain, _wrappedKP3R, _keep3rEscrow) {}

  // Keep3rJobFundableLiquidity

  /// @notice Sidechain implementation asks the Helper for an oracle, instead of reading it from the ERC-20
  /// @dev Function should be called after setting an oracle in Keep3rHelperSidechain
  /// @param _liquidity Address of the liquidity token being approved
  function approveLiquidity(address _liquidity) external virtual override onlyGovernance {
    if (!_approvedLiquidities.add(_liquidity)) revert LiquidityPairApproved();
    _liquidityPool[_liquidity] = IKeep3rHelperSidechain(keep3rHelper).oracle(_liquidity);
    if (_liquidityPool[_liquidity] == address(0)) revert ZeroAddress();
    _isKP3RToken0[_liquidity] = IKeep3rHelper(keep3rHelper).isKP3RToken0(_liquidityPool[_liquidity]);
    _tick[_liquidity] = observeLiquidity(_liquidity);
    emit LiquidityApproval(_liquidity);
  }

  /// @notice Sidechain implementation will always ask for 2 tickCumulatives instead of cacheing
  /// @param _liquidity Address of the liquidity token being observed
  function observeLiquidity(address _liquidity) public view virtual override returns (TickCache memory _tickCache) {
    if (_tick[_liquidity].period == _period(block.timestamp)) {
      // Will return cached twaps if liquidity is updated
      _tickCache = _tick[_liquidity];
    } else {
      bool success;

      // Will always ask for 2 accumulators in sidechain
      uint32[] memory _secondsAgo = new uint32[](2);

      _secondsAgo[0] = uint32(block.timestamp - _period(block.timestamp));
      _secondsAgo[1] = uint32(block.timestamp - _period(block.timestamp) + rewardPeriodTime);

      int56 _tickCumulative2;
      (_tickCache.current, _tickCumulative2, success) = IKeep3rHelper(keep3rHelper).observe(_liquidityPool[_liquidity], _secondsAgo);

      _tickCache.difference = _tickCache.current - _tickCumulative2;

      if (success) {
        _tickCache.period = _period(block.timestamp);
      } else {
        delete _tickCache.period;
      }
    }
  }

  // Keep3rJobsWorkable

  /// @dev Sidechain implementation deprecates worked(address) as it should come with a usdPerGasUnit parameter
  function worked(address) external pure override {
    revert Deprecated();
  }

  /// @notice Implemented by jobs to show that a keeper performed work
  /// @dev Uses a USD per gas unit payment mechanism
  /// @param _keeper Address of the keeper that performed the work
  /// @param _usdPerGasUnit Units of USD (in wei) per gas unit that should be rewarded to the keeper
  function worked(address _keeper, uint256 _usdPerGasUnit) external override {
    // Gas used for quote calculations & payment is not rewarded
    uint256 _gasRecord = gasleft();

    address _job = msg.sender;
    if (disputes[_job]) revert JobDisputed();
    if (!_jobs.contains(_job)) revert JobUnapproved();

    if (_updateJobCreditsIfNeeded(_job)) {
      emit LiquidityCreditsReward(_job, rewardedAt[_job], _jobLiquidityCredits[_job], _jobPeriodCredits[_job]);
    }

    uint256 _boost = IKeep3rHelper(keep3rHelper).getRewardBoostFor(bonds[_keeper][keep3rV1]);
    uint256 _ratedPayment = (_usdPerGasUnit * (_initialGas - _gasRecord) * _boost) / _BASE;

    uint256 _ethPayment = IKeep3rHelperSidechain(keep3rHelper).quoteUsdToEth(_ratedPayment);
    uint256 _kp3rPayment = IKeep3rHelper(keep3rHelper).quote(_ethPayment);

    if (_kp3rPayment > _jobLiquidityCredits[_job]) {
      _rewardJobCredits(_job);
      emit LiquidityCreditsReward(_job, rewardedAt[_job], _jobLiquidityCredits[_job], _jobPeriodCredits[_job]);
    }

    _bondedPayment(_job, _keeper, _kp3rPayment);

    emit KeeperWork(keep3rV1, _job, _keeper, _kp3rPayment, _gasRecord);
  }

  // Keep3rKeeperFundable

  /// @dev Sidechain implementation doesn't burn tokens, but deposit them in Keep3rEscrow
  function _activate(
    address _keeper,
    address _bonding,
    uint256 _amount
  ) internal virtual override {
    // bond provided tokens
    bonds[_keeper][_bonding] += _amount;
    if (_bonding == keep3rV1) {
      IKeep3rV1(keep3rV1).approve(keep3rV1Proxy, _amount);
      IKeep3rEscrow(keep3rV1Proxy).deposit(_amount);
    }
  }
}
