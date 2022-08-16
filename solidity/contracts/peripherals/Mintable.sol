// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../interfaces/peripherals/IMintable.sol';
import './Governable.sol';

abstract contract Mintable is Governable, IMintable {
  /// @inheritdoc IMintable
  address public override minter;

  constructor(address _governance) Governable(_governance) {}

  /// @inheritdoc IMintable
  function setMinter(address _minter) external override onlyGovernance {
    minter = _minter;
    emit MinterSet(_minter);
  }

  /// @notice Functions with this modifier can only be called by the minter;
  modifier onlyMinter() {
    if (msg.sender != minter) revert OnlyMinter();
    _;
  }
}
