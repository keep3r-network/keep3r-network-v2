// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rKeeperFundable {
  // methods
  function bond(address _bonding, uint256 _amount) external;

  function unbond(address _bonding, uint256 _amount) external;

  function activate(address _bonding) external;

  function withdraw(address _bonding) external;
}

interface IKeep3rKeeperDisputable {
  // events
  /// @notice Keeper slashed
  event KeeperSlash(address indexed _keeper, address indexed _slasher, uint256 _block, uint256 _slash);
  /// @notice Keeper revoked
  event KeeperRevoke(address indexed _keeper, address indexed _slasher, uint256 _block);
  /// @notice Keeper disputed
  event KeeperDispute(address indexed _keeper, uint256 _block);
  /// @notice Keeper resolved
  event KeeperResolve(address indexed _keeper, uint256 _block);

  // errors
  error KeeperAlreadyBlackListed();

  // methods
  function slash(
    address _bonded,
    address _keeper,
    uint256 _amount
  ) external;

  function revoke(address _keeper) external;
}

// solhint-disable-next-line no-empty-blocks
interface IKeep3rKeepers is IKeep3rKeeperDisputable {

}
