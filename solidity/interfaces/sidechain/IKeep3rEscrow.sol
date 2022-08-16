// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

// solhint-disable-next-line no-empty-blocks

import '../peripherals/IMintable.sol';

/// @title Keep3rEscrow contract
/// @notice This contract acts as an escrow contract for wKP3R tokens on sidechains and L2s
interface IKeep3rEscrow is IMintable {
  /// @notice Emitted when Keep3rEscrow#deposit function is called
  /// @param _wKP3R The addess of the wrapped KP3R token
  /// @param _sender The address that called the function
  /// @param _amount The amount of wKP3R the user deposited
  event wKP3RDeposited(address _wKP3R, address _sender, uint256 _amount);

  /// @notice Emitted when Keep3rEscrow#mint function is called
  /// @param _wKP3R The addess of the wrapped KP3R token
  /// @param _recipient The address that will received the newly minted wKP3R
  /// @param _amount The amount of wKP3R minted to the recipient
  event wKP3RMinted(address _wKP3R, address _recipient, uint256 _amount);

  /// @notice Emitted when Keep3rEscrow#setWKP3R function is called
  /// @param _newWKP3R The address of the wKP3R contract
  event wKP3RSet(address _newWKP3R);

  /// @notice Throws when minter attempts to withdraw more wKP3R than the escrow has in its balance
  error InsufficientBalance();

  /// @notice Lists the address of the wKP3R contract
  /// @return _wKP3RAddress The address of wKP3R
  function wKP3R() external view returns (address _wKP3RAddress);

  /// @notice Deposits wKP3R into the contract
  /// @param _amount The amount of wKP3R to deposit
  function deposit(uint256 _amount) external;

  /// @notice mints wKP3R to the recipient
  /// @param _amount The amount of wKP3R to mint
  function mint(uint256 _amount) external;

  /// @notice sets the wKP3R address
  /// @param _wKP3R the wKP3R address
  function setWKP3R(address _wKP3R) external;
}
