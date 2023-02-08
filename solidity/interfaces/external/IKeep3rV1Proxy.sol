// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@defi-wonderland/solidity-utils/solidity/interfaces/IBaseErrors.sol';

interface IKeep3rV1Proxy is IBaseErrors {
  // Structs
  struct Recipient {
    address recipient;
    uint256 caps;
  }

  // Variables
  function keep3rV1() external view returns (address);

  function governance() external view returns (address);

  function pendingGovernance() external view returns (address);

  function minter() external view returns (address);

  function next(address) external view returns (uint256);

  function caps(address) external view returns (uint256);

  function recipients() external view returns (address[] memory);

  function recipientsCaps() external view returns (Recipient[] memory);

  // Errors
  error Cooldown();
  error NoDrawableAmount();
  error OnlyMinter();
  error OnlyGovernance();
  error OnlyPendingGovernance();

  // Methods
  function addRecipient(address recipient, uint256 amount) external;

  function removeRecipient(address recipient) external;

  function draw() external returns (uint256 _amount);

  function setKeep3rV1(address _keep3rV1) external;

  function setMinter(address _minter) external;

  function mint(uint256 _amount) external;

  function mint(address _account, uint256 _amount) external;

  function setGovernance(address _governance) external;

  function acceptGovernance() external;

  function setKeep3rV1Governance(address _governance) external;

  function acceptKeep3rV1Governance() external;

  function dispute(address _keeper) external;

  function slash(
    address _bonded,
    address _keeper,
    uint256 _amount
  ) external;

  function revoke(address _keeper) external;

  function resolve(address _keeper) external;

  function addJob(address _job) external;

  function removeJob(address _job) external;

  function addKPRCredit(address _job, uint256 _amount) external;

  function approveLiquidity(address _liquidity) external;

  function revokeLiquidity(address _liquidity) external;

  function setKeep3rHelper(address _keep3rHelper) external;

  function addVotes(address _voter, uint256 _amount) external;

  function removeVotes(address _voter, uint256 _amount) external;
}
