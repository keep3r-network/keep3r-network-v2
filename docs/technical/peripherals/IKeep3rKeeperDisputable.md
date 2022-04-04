## `IKeep3rKeeperDisputable`

Handles the actions that can be taken on a disputed keeper




### `slash(address _keeper, address _bonded, uint256 _bondAmount, uint256 _unbondAmount)` (external)

Allows governance to slash a keeper based on a dispute




### `revoke(address _keeper)` (external)

Blacklists a keeper from participating in the network





### `KeeperSlash(address _keeper, address _slasher, uint256 _amount)`

Emitted when Keep3rKeeperDisputable#slash is called




### `KeeperRevoke(address _keeper, address _slasher)`

Emitted when Keep3rKeeperDisputable#revoke is called






