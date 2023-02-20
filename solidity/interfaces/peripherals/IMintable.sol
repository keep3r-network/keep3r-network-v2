// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@defi-wonderland/solidity-utils/solidity/interfaces/IBaseErrors.sol';
import '@defi-wonderland/solidity-utils/solidity/interfaces/IGovernable.sol';

/// @title Mintable contract
/// @notice Manages the minter role
interface IMintable is IBaseErrors, IGovernable {
  // Events

  /// @notice Emitted when governor sets a new minter
  /// @param _minter Address of the new minter
  event MinterSet(address _minter);

  // Errors

  /// @notice Throws if the caller of the function is not the minter
  error OnlyMinter();

  // Variables

  /// @notice Stores the minter address
  /// @return _minter The minter addresss
  function minter() external view returns (address _minter);

  // Methods

  /// @notice Sets a new address to be the minter
  /// @param _minter The address set as the minter
  function setMinter(address _minter) external;
}
