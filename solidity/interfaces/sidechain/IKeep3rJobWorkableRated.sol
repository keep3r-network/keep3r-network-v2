// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

/// @title Keep3rJobWorkableRated contract
/// @notice Implements a quoting in USD per gas unit for Keep3r jobs
interface IKeep3rJobWorkableRated {
  /// @notice Throws when job contract calls deprecated worked(address) function
  error Deprecated();

  /// @notice Implemented by jobs to show that a keeper performed work and reward in stable USD quote
  /// @dev Automatically calculates the payment for the keeper and pays the keeper with bonded KP3R
  /// @param _keeper Address of the keeper that performed the work
  /// @param _usdPerGasUnit Amount of USD in wei rewarded for gas unit worked by the keeper
  function worked(address _keeper, uint256 _usdPerGasUnit) external;
}
