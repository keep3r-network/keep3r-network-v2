## `IKeep3rAccountance`

Disputes keepers, or if they're already disputed, it can resolve the case


Argument `bonding` can be the address of either a token or a liquidity


### `totalBonds() → uint256 _totalBonds` (external)

Tracks the total amount of bonded KP3Rs in the contract




### `workCompleted(address _keeper) → uint256 _workCompleted` (external)

Tracks the total KP3R earnings of a keeper since it started working




### `firstSeen(address _keeper) → uint256 timestamp` (external)

Tracks when a keeper was first registered




### `disputes(address _keeperOrJob) → bool _disputed` (external)

Tracks if a keeper or job has a pending dispute




### `bonds(address _keeper, address _bond) → uint256 _bonds` (external)

Tracks how much a keeper has bonded of a certain token




### `jobTokenCredits(address _job, address _token) → uint256 _amount` (external)

The current token credits available for a job




### `pendingBonds(address _keeper, address _bonding) → uint256 _pendingBonds` (external)

Tracks the amount of assets deposited in pending bonds




### `canActivateAfter(address _keeper, address _bonding) → uint256 _timestamp` (external)

Tracks when a bonding for a keeper can be activated




### `canWithdrawAfter(address _keeper, address _bonding) → uint256 _timestamp` (external)

Tracks when keeper bonds are ready to be withdrawn




### `pendingUnbonds(address _keeper, address _bonding) → uint256 _pendingUnbonds` (external)

Tracks how much keeper bonds are to be withdrawn




### `hasBonded(address _keeper) → bool _hasBonded` (external)

Checks whether the address has ever bonded an asset




### `jobs() → address[] _jobList` (external)

Lists all jobs




### `keepers() → address[] _keeperList` (external)

Lists all keepers





### `Bonding(address _keeper, address _bonding, uint256 _amount)`

Emitted when the bonding process of a new keeper begins




### `Unbonding(address _keeperOrJob, address _unbonding, uint256 _amount)`

Emitted when a keeper or job begins the unbonding process to withdraw the funds






