// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rRoles {
  // events

  event SlasherAdded(address _slasher);
  event SlasherRemoved(address _slasher);
  event DisputerAdded(address _disputer);
  event DisputerRemoved(address _disputer);

  // variables

  function slashers(address _slasher) external view returns (bool);

  function disputers(address _disputer) external view returns (bool);

  // errors
  error SlasherExistent();
  error SlasherUnexistent();
  error DisputerExistent();
  error DisputerUnexistent();
  error OnlySlasherOrGovernance();
  error OnlyDisputerOrGovernance();

  // methods
  function addSlasher(address _slasher) external;

  function removeSlasher(address _slasher) external;

  function addDisputer(address _disputer) external;

  function removeDisputer(address _disputer) external;
}
