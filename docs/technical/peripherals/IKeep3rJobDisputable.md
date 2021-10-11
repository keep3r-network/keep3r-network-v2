## `IKeep3rJobDisputable`

Handles the actions that can be taken on a disputed job




### `slashTokenFromJob(address _job, address _token, uint256 _amount)` (external)

Allows governance or slasher to slash a job specific token




### `slashLiquidityFromJob(address _job, address _liquidity, uint256 _amount)` (external)

Allows governance or a slasher to slash liquidity from a job





### `JobSlashToken(address _job, address _token, address _slasher, uint256 _amount)`

Emitted when Keep3rJobDisputable#slashTokenFromJob is called




### `JobSlashLiquidity(address _job, address _liquidity, address _slasher, uint256 _amount)`

Emitted when Keep3rJobDisputable#slashLiquidityFromJob is called






