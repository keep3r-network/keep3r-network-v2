## `IKeep3rJobWorkable`

Handles the mechanisms jobs can pay keepers with along with the restrictions jobs can put on keepers before they can work on jobs




### `isKeeper(address _keeper) → bool _isKeeper` (external)

Confirms if the current keeper is registered, can be used for general (non critical) functions




### `isBondedKeeper(address _keeper, address _bond, uint256 _minBond, uint256 _earned, uint256 _age) → bool _isBondedKeeper` (external)

Confirms if the current keeper is registered and has a minimum bond of any asset. Should be used for protected functions




### `worked(address _keeper)` (external)

Implemented by jobs to show that a keeper performed work


Automatically calculates the payment for the keeper


### `bondedPayment(address _keeper, uint256 _payment)` (external)

Implemented by jobs to show that a keeper performed work


Pays the keeper that performs the work with KP3R


### `directTokenPayment(address _token, address _keeper, uint256 _amount)` (external)

Implemented by jobs to show that a keeper performed work


Pays the keeper that performs the work with a specific token



### `KeeperValidation(uint256 _gasLeft)`

Emitted when a keeper is validated before a job




### `KeeperWork(address _credit, address _job, address _keeper, uint256 _amount, uint256 _gasLeft)`

Emitted when a keeper works a job






