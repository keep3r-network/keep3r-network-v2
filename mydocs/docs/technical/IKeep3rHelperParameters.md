## `IKeep3rHelperParameters`

Contains all the helper functions used throughout the different files.




### `KP3R() → address _kp3r` (external)

Address of KP3R token




### `BOOST_BASE() → uint256 _base` (external)

The boost base used to calculate the boost rewards for the keeper




### `kp3rWethPool() → address poolAddress, bool isKP3RToken0` (external)

KP3R-WETH pool that is being used as oracle




### `minBoost() → uint256 _multiplier` (external)

The minimum multiplier used to calculate the amount of gas paid to the Keeper for the gas used to perform a job
        For example: if the quoted gas used is 1000, then the minimum amount to be paid will be 1000 * minBoost / BOOST_BASE




### `maxBoost() → uint256 _multiplier` (external)

The maximum multiplier used to calculate the amount of gas paid to the Keeper for the gas used to perform a job
        For example: if the quoted gas used is 1000, then the maximum amount to be paid will be 1000 * maxBoost / BOOST_BASE




### `targetBond() → uint256 _target` (external)

The targeted amount of bonded KP3Rs to max-up reward multiplier
        For example: if the amount of KP3R the keeper has bonded is targetBond or more, then the keeper will get
                     the maximum boost possible in his rewards, if it's less, the reward boost will be proportional




### `workExtraGas() → uint256 _workExtraGas` (external)

The amount of unaccounted gas that is going to be added to keeper payments




### `quoteTwapTime() → uint32 _quoteTwapTime` (external)

The twap time for quoting




### `minBaseFee() → uint256 _minBaseFee` (external)

The minimum base fee that is used to calculate keeper rewards




### `minPriorityFee() → uint256 _minPriorityFee` (external)

The minimum priority fee that is also rewarded for keepers




### `keep3rV2() → address _keep3rV2` (external)

Address of Keep3r V2




### `setKp3rWethPool(address _poolAddress)` (external)

Sets KP3R-WETH pool




### `setMinBoost(uint256 _minBoost)` (external)

Sets the minimum boost multiplier




### `setMaxBoost(uint256 _maxBoost)` (external)

Sets the maximum boost multiplier




### `setTargetBond(uint256 _targetBond)` (external)

Sets the target bond amount




### `setKeep3rV2(address _keep3rV2)` (external)

Sets the Keep3r V2 address




### `setWorkExtraGas(uint256 _workExtraGas)` (external)

Sets the work extra gas amount




### `setQuoteTwapTime(uint32 _quoteTwapTime)` (external)

Sets the quote twap time




### `setMinBaseFee(uint256 _minBaseFee)` (external)

Sets the minimum rewarded gas fee




### `setMinPriorityFee(uint256 _minPriorityFee)` (external)

Sets the minimum rewarded gas priority fee





### `Kp3rWethPoolChange(address _address, bool _isKP3RToken0)`

Emitted when the kp3r weth pool is changed




### `MinBoostChange(uint256 _minBoost)`

Emitted when the minimum boost multiplier is changed




### `MaxBoostChange(uint256 _maxBoost)`

Emitted when the maximum boost multiplier is changed




### `TargetBondChange(uint256 _targetBond)`

Emitted when the target bond amount is changed




### `Keep3rV2Change(address _keep3rV2)`

Emitted when the Keep3r V2 address is changed




### `WorkExtraGasChange(uint256 _workExtraGas)`

Emitted when the work extra gas amount is changed




### `QuoteTwapTimeChange(uint32 _quoteTwapTime)`

Emitted when the quote twap time is changed




### `MinBaseFeeChange(uint256 _minBaseFee)`

Emitted when minimum rewarded gas fee is changed




### `MinPriorityFeeChange(uint256 _minPriorityFee)`

Emitted when minimum rewarded priority fee is changed





### `Kp3rWethPool`


address poolAddress


bool isKP3RToken0



