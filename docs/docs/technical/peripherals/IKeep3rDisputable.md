## `IKeep3rDisputable`

Creates/resolves disputes for jobs or keepers
        A disputed keeper is slashable and is not able to bond, activate, withdraw or receive direct payments
        A disputed job is slashable and is not able to pay the keepers, withdraw tokens or to migrate




### `dispute(address _jobOrKeeper)` (external)

Allows governance to create a dispute for a given keeper/job




### `resolve(address _jobOrKeeper)` (external)

Allows governance to resolve a dispute on a keeper/job





### `Dispute(address _jobOrKeeper, address _disputer)`

Emitted when a keeper or a job is disputed




### `Resolve(address _jobOrKeeper, address _resolver)`

Emitted when a dispute is resolved






