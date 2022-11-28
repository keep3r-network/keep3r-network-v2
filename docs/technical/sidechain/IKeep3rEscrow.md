## `IKeep3rEscrow`

This contract acts as an escrow contract for wKP3R tokens on sidechains and L2s


Can be used as a replacement for keep3rV1Proxy in keep3r sidechain implementations


### `wKP3R() → address _wKP3RAddress` (external)

Lists the address of the wKP3R contract




### `deposit(uint256 _amount)` (external)

Deposits wKP3R into the contract




### `mint(uint256 _amount)` (external)

mints wKP3R to the recipient




### `setWKP3R(address _wKP3R)` (external)

sets the wKP3R address





### `wKP3RDeposited(address _wKP3R, address _sender, uint256 _amount)`

Emitted when Keep3rEscrow#deposit function is called




### `wKP3RMinted(address _wKP3R, address _recipient, uint256 _amount)`

Emitted when Keep3rEscrow#mint function is called




### `wKP3RSet(address _newWKP3R)`

Emitted when Keep3rEscrow#setWKP3R function is called






