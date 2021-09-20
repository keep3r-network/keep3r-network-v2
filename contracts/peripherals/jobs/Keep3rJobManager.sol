// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rJobOwnership.sol';
import '../Keep3rRoles.sol';
import '../Keep3rParameters.sol';
import '../../interfaces/peripherals/IKeep3rJobs.sol';

abstract contract Keep3rJobManager is IKeep3rJobManager, Keep3rJobOwnership, Keep3rRoles, Keep3rParameters {
  using EnumerableSet for EnumerableSet.AddressSet;

  /**
   * @notice Allows governance to add new job systems
   * @param _job address of the contract for which work should be performed
   */
  function addJob(address _job) external override {
    if (_jobs.contains(_job)) revert JobAlreadyAdded();
    if (hasBonded[_job]) revert AlreadyAKeeper();
    _jobs.add(_job);
    jobOwner[_job] = msg.sender;
    emit JobAddition(_job, block.number, msg.sender);
  }

  /**
   * @notice Allows governance to remove a job from the systems
   * @param _job address of the contract for which work should be performed
   */
  function removeJob(address _job) external override onlyGovernance {
    if (!_jobs.contains(_job)) revert JobUnexistent();
    _jobs.remove(_job);
    emit JobRemoval(_job, block.number, msg.sender);
  }
}
