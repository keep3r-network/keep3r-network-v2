// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../interfaces/peripherals/IKeep3rJobs.sol';

abstract contract Keep3rJobOwnership is IKeep3rJobOwnership {
  /// @notice owner of the job (job => user)
  mapping(address => address) public override jobOwner;
  /// @notice pending owner of the job (job => user)
  mapping(address => address) public override jobPendingOwner;

  function changeJobOwnership(address _job, address _newOwner) external override onlyJobOwner(_job) {
    jobPendingOwner[_job] = _newOwner;
    emit JobOwnershipChange(_job, jobOwner[_job], _newOwner);
  }

  function acceptJobOwnership(address _job) external override onlyPendingJobOwner(_job) {
    address _previousOwner = jobOwner[_job];

    jobOwner[_job] = jobPendingOwner[_job];
    delete jobPendingOwner[_job];

    emit JobOwnershipAssent(_job, _previousOwner, msg.sender);
  }

  modifier onlyJobOwner(address _job) {
    if (msg.sender != jobOwner[_job]) revert OnlyJobOwner();
    _;
  }

  modifier onlyPendingJobOwner(address _job) {
    if (msg.sender != jobPendingOwner[_job]) revert OnlyPendingJobOwner();
    _;
  }
}
