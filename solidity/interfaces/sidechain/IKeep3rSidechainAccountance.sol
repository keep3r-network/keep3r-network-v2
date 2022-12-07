// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

/// @title IKeep3rSidechainAccountance interface
/// @notice Implements a view to get the amount of credits that can be withdrawn
interface IKeep3rSidechainAccountance {
  /// @notice The surplus amount of wKP3Rs in escrow contract
  /// @return _virtualReserves The surplus amount of wKP3Rs in escrow contract
  function virtualReserves() external view returns (int256 _virtualReserves);
}
