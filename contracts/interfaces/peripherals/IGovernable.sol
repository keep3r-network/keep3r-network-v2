// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IGovernable {
  // events
  event GovernanceSet(address _governance);
  event GovernanceProposal(address _pendingGovernance);

  // errors
  error OnlyGovernance();
  error OnlyPendingGovernance();
  error NoGovernanceZeroAddress();

  // variables
  function governance() external view returns (address);

  function pendingGovernance() external view returns (address);

  // methods
  function setGovernance(address _governance) external;

  function acceptGovernance() external;
}
