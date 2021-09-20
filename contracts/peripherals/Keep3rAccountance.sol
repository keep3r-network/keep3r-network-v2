// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '../interfaces/peripherals/IKeep3rAccountance.sol';

abstract contract Keep3rAccountance is IKeep3rAccountance {
  using EnumerableSet for EnumerableSet.AddressSet;

  /// @notice list of all enabled keepers
  EnumerableSet.AddressSet internal _keepers;
  /// @notice tracks last job performed for a keeper
  mapping(address => uint256) public override lastJob;
  /// @notice tracks the total job executions for a keeper
  mapping(address => uint256) public override workCompleted;
  /// @notice tracks when a keeper was first registered
  mapping(address => uint256) public override firstSeen;
  /// @notice tracks if a keeper or job has a pending dispute
  mapping(address => bool) public override disputes;
  /// @notice tracks how much a keeper has bonded
  mapping(address => mapping(address => uint256)) public override bonds;
  /// @notice the current token credits available for a job
  mapping(address => mapping(address => uint256)) public override jobTokenCredits;
  /// @notice the current liquidity credits available for a job
  mapping(address => uint256) internal _jobLiquidityCredits;
  /// @notice job => periodCredits
  mapping(address => uint256) internal _jobPeriodCredits;
  // @notice enumerable array of Job Tokens for Credits
  mapping(address => EnumerableSet.AddressSet) internal _jobTokens;
  /// @notice list of liquidities that a job has (job => liquidities)
  mapping(address => EnumerableSet.AddressSet) internal _jobLiquidities;
  /// @notice liquidity pool to observe
  mapping(address => address) internal _liquidityPool;
  /// @notice tracks if a pool has KP3R as token0
  mapping(address => bool) internal _isKP3RToken0;
  /// @notice tracks all current pending bonds (amount)
  mapping(address => mapping(address => uint256)) public override pendingBonds;
  /// @notice tracks when a bonding for a keeper can be activated (keeper => bonding => time)
  mapping(address => mapping(address => uint256)) public override canActivateAfter;
  /// @notice tracks when keeper bonds are ready to be withdrawn (keeper => bonding => time)
  mapping(address => mapping(address => uint256)) public override canWithdrawAfter;
  /// @notice allows for partial unbonding
  mapping(address => mapping(address => uint256)) public override pendingUnbonds;
  /// @notice checks whether the address has ever bonded an asset
  mapping(address => bool) public override hasBonded;

  /// @notice list of all enabled jobs
  EnumerableSet.AddressSet internal _jobs;

  function jobs() external view override returns (address[] memory _list) {
    _list = _jobs.values();
  }

  function keepers() external view override returns (address[] memory _list) {
    _list = _keepers.values();
  }
}
