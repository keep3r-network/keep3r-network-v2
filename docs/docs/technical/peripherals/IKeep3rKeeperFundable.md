## `IKeep3rKeeperFundable`

Handles the actions required to become a keeper




### `bond(address _bonding, uint256 _amount)` (external)

Beginning of the bonding process




### `unbond(address _bonding, uint256 _amount)` (external)

Beginning of the unbonding process




### `activate(address _bonding)` (external)

End of the bonding process after bonding time has passed




### `withdraw(address _bonding)` (external)

Withdraw funds after unbonding has finished





### `Activation(address _keeper, address _bond, uint256 _amount)`

Emitted when Keep3rKeeperFundable#activate is called




### `Withdrawal(address _keeper, address _bond, uint256 _amount)`

Emitted when Keep3rKeeperFundable#withdraw is called






