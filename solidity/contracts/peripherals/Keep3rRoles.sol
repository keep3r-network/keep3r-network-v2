// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/peripherals/IKeep3rRoles.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import './Governable.sol';

contract Keep3rRoles is IKeep3rRoles, Governable {
  mapping(address => bool) public override slashers;
  mapping(address => bool) public override disputers;

  constructor(address _governance) Governable(_governance) {}

  function addSlasher(address _slasher) external override onlyGovernance {
    if (slashers[_slasher]) revert SlasherExistent();
    slashers[_slasher] = true;
    emit SlasherAdded(_slasher);
  }

  function removeSlasher(address _slasher) external override onlyGovernance {
    if (!slashers[_slasher]) revert SlasherUnexistent();
    delete slashers[_slasher];
    emit SlasherRemoved(_slasher);
  }

  function addDisputer(address _disputer) external override onlyGovernance {
    if (disputers[_disputer]) revert DisputerExistent();
    disputers[_disputer] = true;
    emit DisputerAdded(_disputer);
  }

  function removeDisputer(address _disputer) external override onlyGovernance {
    if (!disputers[_disputer]) revert DisputerUnexistent();
    delete disputers[_disputer];
    emit DisputerRemoved(_disputer);
  }

  modifier onlySlasherOrGovernance {
    if (!slashers[msg.sender] && msg.sender != governance) revert OnlySlasherOrGovernance();
    _;
  }

  modifier onlyDisputerOrGovernance {
    if (!disputers[msg.sender] && msg.sender != governance) revert OnlyDisputerOrGovernance();
    _;
  }
}
