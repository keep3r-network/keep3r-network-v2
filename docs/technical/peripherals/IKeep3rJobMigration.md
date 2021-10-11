## `IKeep3rJobMigration`

Handles the migration process of jobs to different addresses




### `pendingJobMigrations(address _fromJob) → address _toJob` (external)

Maps the jobs that have requested a migration to the address they have requested to migrate to




### `migrateJob(address _fromJob, address _toJob)` (external)

Initializes the migration process for a job by adding the request to the pendingJobMigrations mapping




### `acceptJobMigration(address _fromJob, address _toJob)` (external)

Completes the migration process for a job


Unbond/withdraw process doesn't get migrated



### `JobMigrationRequested(address _fromJob, address _toJob)`

Emitted when Keep3rJobMigration#migrateJob function is called




### `JobMigrationSuccessful(address _fromJob, address _toJob)`

Emitted when Keep3rJobMigration#acceptJobMigration function is called






