// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../interfaces/peripherals/IMintable.sol';
import '@defi-wonderland/solidity-utils/solidity/contracts/Governable.sol';

abstract contract Mintable is Governable, IMintable {
  /// @inheritdoc IMintable
  address public override minter;

  constructor(address _governor) Governable(_governor) {}

  /// @inheritdoc IMintable
  function setMinter(address _minter) external override onlyGovernor {
    if (_minter == address(0)) revert ZeroAddress();
    minter = _minter;
    emit MinterSet(_minter);
  }

  /// @notice Functions with this modifier can only be called by the minter;
  modifier onlyMinter() {
    if (msg.sender != minter) revert OnlyMinter();
    _;
  }
}
