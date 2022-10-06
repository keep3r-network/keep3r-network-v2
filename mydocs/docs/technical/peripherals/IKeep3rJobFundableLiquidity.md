## `IKeep3rJobFundableLiquidity`

Handles the funding of jobs through specific liquidity pairs




### `approvedLiquidities() → address[] _list` (external)

Lists liquidity pairs




### `liquidityAmount(address _job, address _liquidity) → uint256 _amount` (external)

Amount of liquidity in a specified job




### `rewardedAt(address _job) → uint256 _timestamp` (external)

Last time the job was rewarded liquidity credits




### `workedAt(address _job) → uint256 _timestamp` (external)

Last time the job was worked




### `jobLiquidityCredits(address _job) → uint256 _amount` (external)

Returns the liquidity credits of a given job




### `jobPeriodCredits(address _job) → uint256 _amount` (external)

Returns the credits of a given job for the current period




### `totalJobCredits(address _job) → uint256 _amount` (external)

Calculates the total credits of a given job




### `quoteLiquidity(address _liquidity, uint256 _amount) → uint256 _periodCredits` (external)

Calculates how many credits should be rewarded periodically for a given liquidity amount


_periodCredits = underlying KP3Rs for given liquidity amount * rewardPeriod / inflationPeriod


### `observeLiquidity(address _liquidity) → struct IKeep3rJobFundableLiquidity.TickCache _tickCache` (external)

Observes the current state of the liquidity pair being observed and updates TickCache with the information




### `forceLiquidityCreditsToJob(address _job, uint256 _amount)` (external)

Gifts liquidity credits to the specified job




### `approveLiquidity(address _liquidity)` (external)

Approve a liquidity pair for being accepted in future




### `revokeLiquidity(address _liquidity)` (external)

Revoke a liquidity pair from being accepted in future




### `addLiquidityToJob(address _job, address _liquidity, uint256 _amount)` (external)

Allows anyone to fund a job with liquidity




### `unbondLiquidityFromJob(address _job, address _liquidity, uint256 _amount)` (external)

Unbond liquidity for a job


Can only be called by the job's owner


### `withdrawLiquidityFromJob(address _job, address _liquidity, address _receiver)` (external)

Withdraw liquidity from a job





### `LiquidityApproval(address _liquidity)`

Emitted when Keep3rJobFundableLiquidity#approveLiquidity function is called




### `LiquidityRevocation(address _liquidity)`

Emitted when Keep3rJobFundableLiquidity#revokeLiquidity function is called




### `LiquidityAddition(address _job, address _liquidity, address _provider, uint256 _amount)`

Emitted when IKeep3rJobFundableLiquidity#addLiquidityToJob function is called




### `LiquidityWithdrawal(address _job, address _liquidity, address _receiver, uint256 _amount)`

Emitted when IKeep3rJobFundableLiquidity#withdrawLiquidityFromJob function is called




### `LiquidityCreditsReward(address _job, uint256 _rewardedAt, uint256 _currentCredits, uint256 _periodCredits)`

Emitted when Keep3rJobFundableLiquidity#addLiquidityToJob function is called




### `LiquidityCreditsForced(address _job, uint256 _rewardedAt, uint256 _currentCredits)`

Emitted when Keep3rJobFundableLiquidity#forceLiquidityCreditsToJob function is called





### `TickCache`


int56 current


int56 difference


uint256 period



