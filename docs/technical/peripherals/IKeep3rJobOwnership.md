## `IKeep3rJobOwnership`

Handles the ownership of the jobs




### `jobOwner(address _job) → address _owner` (external)

Maps the job to the owner of the job




### `jobPendingOwner(address _job) → address _pendingOwner` (external)

Maps the job to its pending owner




### `changeJobOwnership(address _job, address _newOwner)` (external)

Proposes a new address to be the owner of the job




### `acceptJobOwnership(address _job)` (external)

The proposed address accepts to be the owner of the job





### `JobOwnershipChange(address _job, address _owner, address _pendingOwner)`

Emitted when Keep3rJobOwnership#changeJobOwnership is called




### `JobOwnershipAssent(address _job, address _previousOwner, address _newOwner)`

Emitted when Keep3rJobOwnership#JobOwnershipAssent is called






