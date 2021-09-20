// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rAccountance {
  // variables
  function lastJob(address _keeper) external view returns (uint256);

  function workCompleted(address _keeper) external view returns (uint256);

  function firstSeen(address _keeper) external view returns (uint256);

  function disputes(address _keeper) external view returns (bool);

  function bonds(address _keeper, address _bond) external view returns (uint256);

  function jobTokenCredits(address _job, address _token) external view returns (uint256 _amount);

  function pendingBonds(address _keeper, address _bonding) external view returns (uint256);

  function canActivateAfter(address _keeper, address _bonding) external view returns (uint256);

  function canWithdrawAfter(address _keeper, address _bonding) external view returns (uint256);

  function pendingUnbonds(address _keeper, address _bonding) external view returns (uint256);

  function hasBonded(address _keeper) external view returns (bool);

  // methods
  function jobs() external view returns (address[] memory _jobList);

  function keepers() external view returns (address[] memory _keeperList);

  // errors
  error JobUnavailable();
  error JobDisputed();
  error AlreadyAJob();
  error AlreadyAKeeper();
}
