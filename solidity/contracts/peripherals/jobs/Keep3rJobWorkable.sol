// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rJobMigration.sol';
import '../../interfaces/IKeep3rHelper.sol';
import '../../interfaces/peripherals/IKeep3rJobs.sol';
import '../../libraries/Keep3rLibrary.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

abstract contract Keep3rJobWorkable is IKeep3rJobWorkable, Keep3rJobMigration {
  using EnumerableSet for EnumerableSet.AddressSet;
  using SafeERC20 for IERC20;

  uint256 internal _initialGas;

  /**
   * @notice confirms if the current keeper is registered, can be used for general (non critical) functions
   * @param _keeper the keeper being investigated
   * @return true/false if the address is a keeper
   */
  function isKeeper(address _keeper) external override returns (bool) {
    _initialGas = gasleft();
    return _keepers.contains(_keeper);
  }

  /**
   * @notice confirms if the current keeper is registered and has a minimum bond, should be used for protected functions
   * @param _keeper the keeper being investigated
   * @param _minBond the minimum requirement for the asset provided in bond
   * @param _earned the total funds earned in the keepers lifetime
   * @param _age the age of the keeper in the system
   * @return true/false if the address is a keeper and has more than the bond
   */
  function isMinKeeper(
    address _keeper,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age
  ) external override returns (bool) {
    _initialGas = gasleft();
    return
      _keepers.contains(_keeper) &&
      bonds[_keeper][keep3rV1] >= _minBond &&
      workCompleted[_keeper] >= _earned &&
      block.timestamp - firstSeen[_keeper] >= _age;
  }

  /**
   * @notice confirms if the current keeper is registered and has a minimum bond, should be used for protected functions
   * @param _keeper the keeper being investigated
   * @param _bond the bound asset being evaluated
   * @param _minBond the minimum requirement for the asset provided in bond
   * @param _earned the total funds earned in the keepers lifetime
   * @param _age the age of the keeper in the system
   * @return true/false if the address is a keeper and has more than the bond
   */
  function isBondedKeeper(
    address _keeper,
    address _bond,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age
  ) external override returns (bool) {
    _initialGas = gasleft();
    return
      _keepers.contains(_keeper) &&
      bonds[_keeper][_bond] >= _minBond &&
      workCompleted[_keeper] >= _earned &&
      block.timestamp - firstSeen[_keeper] >= _age;
  }

  /**
   * @notice Implemented by jobs to show that a keeper performed work
   * @param _keeper address of the keeper that performed the work
   */
  function worked(address _keeper) external override {
    address _job = msg.sender;
    if (!_jobs.contains(_job)) revert JobUnapproved();

    if (_updateJobCreditsIfNeeded(_job)) {
      emit JobCreditsUpdated(_job, rewardedAt[_job], _jobLiquidityCredits[_job]);
    }

    uint256 _gasRecord = gasleft();
    (uint256 _boost, uint256 _boostBase) = IKeep3rHelper(keep3rHelper).getRewardBoostFor(bonds[_keeper][keep3rV1]);

    uint256 _payment = (_quoteLiquidity(_initialGas - _gasRecord, kp3rWethPool) * _boost) / _boostBase;

    if (_payment > _jobLiquidityCredits[_job]) {
      _rewardJobCredits(_job);
      emit JobCreditsUpdated(_job, rewardedAt[_job], _jobLiquidityCredits[_job]);
    }

    _payment = ((_initialGas - gasleft()) * _payment) / (_initialGas - _gasRecord);

    _bondedPayment(_job, _keeper, _payment);
  }

  /**
   * @notice Implemented by jobs to show that a keeper performed work
   * @param _keeper address of the keeper that performed the work
   * @param _payment the reward that should be allocated for the job
   */
  function bondedPayment(address _keeper, uint256 _payment) public override {
    address _job = msg.sender;

    if (disputes[_job]) revert JobDisputed();
    if (!_jobs.contains(_job)) revert JobUnapproved();

    if (_updateJobCreditsIfNeeded(_job)) {
      emit JobCreditsUpdated(_job, rewardedAt[_job], _jobLiquidityCredits[_job]);
    }

    if (_payment > _jobLiquidityCredits[_job]) {
      _rewardJobCredits(_job);
      emit JobCreditsUpdated(_job, rewardedAt[_job], _jobLiquidityCredits[_job]);
    }

    _bondedPayment(_job, _keeper, _payment);
  }

  function _bondedPayment(
    address _job,
    address _keeper,
    uint256 _payment
  ) internal {
    if (_payment > _jobLiquidityCredits[_job]) revert InsufficientFunds();

    lastJob[_keeper] = block.timestamp;
    workedAt[_job] = block.timestamp;
    _jobLiquidityCredits[_job] -= _payment;
    bonds[_keeper][keep3rV1] += _payment;
    workCompleted[_keeper] += _payment;
    emit KeeperWork(keep3rV1, _job, _keeper, block.number, _payment, _jobLiquidityCredits[_job]);
  }

  /**
   * @notice Implemented by jobs to show that a keeper performed work
   * @param _token the asset being awarded to the keeper
   * @param _keeper address of the keeper that performed the work
   * @param _amount the reward that should be allocated
   */
  function directTokenPayment(
    address _token,
    address _keeper,
    uint256 _amount
  ) external override {
    address _job = msg.sender;

    if (disputes[_job]) revert JobDisputed();
    if (!_jobs.contains(_job)) revert JobUnapproved();
    if (jobTokenCredits[_job][_token] < _amount) revert InsufficientFunds();
    jobTokenCredits[_job][_token] -= _amount;
    lastJob[_keeper] = block.timestamp;
    IERC20(_token).safeTransfer(_keeper, _amount);
    emit KeeperWork(_token, _job, _keeper, block.number, _amount, jobTokenCredits[_job][_token]);
  }
}
