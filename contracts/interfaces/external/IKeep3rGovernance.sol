// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rGovernance {
  // events
  event GovernanceSet(address _governance);
  event GovernanceProposal(address _pendingGovernance);

  // variables
  function governance() external view returns (address);

  function pendingGovernance() external view returns (address);

  // errors
  error OnlyGovernance();
  error OnlyPendingGovernance();

  // methods
  function setGovernance(address _governance) external;

  function acceptGovernance() external;
}
