## `IKeep3rParameters`

Handles and sets all the required parameters for Keep3r




### `keep3rHelper() → address _keep3rHelper` (external)

Address of Keep3rHelper's contract




### `keep3rV1() → address _keep3rV1` (external)

Address of Keep3rV1's contract




### `keep3rV1Proxy() → address _keep3rV1Proxy` (external)

Address of Keep3rV1Proxy's contract




### `kp3rWethPool() → address _kp3rWethPool` (external)

Address of the KP3R-WETH pool




### `bondTime() → uint256 _days` (external)

The amount of time required to pass after a keeper has bonded assets for it to be able to activate




### `unbondTime() → uint256 _days` (external)

The amount of time required to pass before a keeper can unbond what he has bonded




### `liquidityMinimum() → uint256 _amount` (external)

The minimum amount of liquidity required to fund a job per liquidity




### `rewardPeriodTime() → uint256 _days` (external)

The amount of time between each scheduled credits reward given to a job




### `inflationPeriod() → uint256 _period` (external)

The inflation period is the denominator used to regulate the emission of KP3R




### `fee() → uint256 _amount` (external)

The fee to be sent to governance when a user adds liquidity to a job




### `setKeep3rHelper(address _keep3rHelper)` (external)

Sets the Keep3rHelper address




### `setKeep3rV1(address _keep3rV1)` (external)

Sets the Keep3rV1 address




### `setKeep3rV1Proxy(address _keep3rV1Proxy)` (external)

Sets the Keep3rV1Proxy address




### `setKp3rWethPool(address _kp3rWethPool)` (external)

Sets the KP3R-WETH pool address




### `setBondTime(uint256 _bond)` (external)

Sets the bond time required to activate as a keeper




### `setUnbondTime(uint256 _unbond)` (external)

Sets the unbond time required unbond what has been bonded




### `setLiquidityMinimum(uint256 _liquidityMinimum)` (external)

Sets the minimum amount of liquidity required to fund a job




### `setRewardPeriodTime(uint256 _rewardPeriodTime)` (external)

Sets the time required to pass between rewards for jobs




### `setInflationPeriod(uint256 _inflationPeriod)` (external)

Sets the new inflation period




### `setFee(uint256 _fee)` (external)

Sets the new fee





### `Keep3rHelperChange(address _keep3rHelper)`

Emitted when the Keep3rHelper address is changed




### `Keep3rV1Change(address _keep3rV1)`

Emitted when the Keep3rV1 address is changed




### `Keep3rV1ProxyChange(address _keep3rV1Proxy)`

Emitted when the Keep3rV1Proxy address is changed




### `Kp3rWethPoolChange(address _kp3rWethPool)`

Emitted when the KP3R-WETH pool address is changed




### `BondTimeChange(uint256 _bondTime)`

Emitted when bondTime is changed




### `LiquidityMinimumChange(uint256 _liquidityMinimum)`

Emitted when _liquidityMinimum is changed




### `UnbondTimeChange(uint256 _unbondTime)`

Emitted when _unbondTime is changed




### `RewardPeriodTimeChange(uint256 _rewardPeriodTime)`

Emitted when _rewardPeriodTime is changed




### `InflationPeriodChange(uint256 _inflationPeriod)`

Emitted when the inflationPeriod is changed




### `FeeChange(uint256 _fee)`

Emitted when the fee is changed






