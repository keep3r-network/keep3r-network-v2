## `IKeep3rJobFundableCredits`

Handles the addition and withdrawal of credits from a job




### `jobTokenCreditsAddedAt(address _job, address _token) → uint256 _timestamp` (external)

Last block where tokens were added to the job




### `addTokenCreditsToJob(address _job, address _token, uint256 _amount)` (external)

Add credit to a job to be paid out for work




### `withdrawTokenCreditsFromJob(address _job, address _token, uint256 _amount, address _receiver)` (external)

Withdraw credit from a job





### `TokenCreditAddition(address _job, address _token, address _provider, uint256 _amount)`

Emitted when Keep3rJobFundableCredits#addTokenCreditsToJob is called




### `TokenCreditWithdrawal(address _job, address _token, address _receiver, uint256 _amount)`

Emitted when Keep3rJobFundableCredits#withdrawTokenCreditsFromJob is called






