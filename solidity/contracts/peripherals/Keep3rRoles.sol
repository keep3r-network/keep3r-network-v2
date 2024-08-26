// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../interfaces/peripherals/IKeep3rRoles.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@defi-wonderland/solidity-utils/solidity/contracts/DustCollector.sol';
import '@defi-wonderland/solidity-utils/solidity/contracts/Governable.sol';

contract Keep3rRoles is IKeep3rRoles, Governable, DustCollector {
  /// @inheritdoc IKeep3rRoles
  mapping(address => bool) public override slashers;

  /// @inheritdoc IKeep3rRoles
  mapping(address => bool) public override disputers;

  constructor(address _governor) Governable(_governor) DustCollector() {}

  /// @inheritdoc IKeep3rRoles
  function addSlasher(address _slasher) external override onlyGovernor {
    if (_slasher == address(0)) revert ZeroAddress();
    if (slashers[_slasher]) revert SlasherExistent();
    slashers[_slasher] = true;
    emit SlasherAdded(_slasher);
  }

  /// @inheritdoc IKeep3rRoles
  function removeSlasher(address _slasher) external override onlyGovernor {
    if (!slashers[_slasher]) revert SlasherUnexistent();
    delete slashers[_slasher];
    emit SlasherRemoved(_slasher);
  }

  /// @inheritdoc IKeep3rRoles
  function addDisputer(address _disputer) external override onlyGovernor {
    if (_disputer == address(0)) revert ZeroAddress();
    if (disputers[_disputer]) revert DisputerExistent();
    disputers[_disputer] = true;
    emit DisputerAdded(_disputer);
  }

  /// @inheritdoc IKeep3rRoles
  function removeDisputer(address _disputer) external override onlyGovernor {
    if (!disputers[_disputer]) revert DisputerUnexistent();
    delete disputers[_disputer];
    emit DisputerRemoved(_disputer);
  }

  /// @notice Functions with this modifier can only be called by either a slasher or governance
  modifier onlySlasher {
    if (!slashers[msg.sender]) revert OnlySlasher();
    _;
  }

  /// @notice Functions with this modifier can only be called by either a disputer or governance
  modifier onlyDisputer {
    if (!disputers[msg.sender]) revert OnlyDisputer();
    _;
  }
}
