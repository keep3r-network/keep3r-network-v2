---
sidebar_position: 4
---

# Managing Protocol Parameters

When There are certain protocol-specific parameters that can be changed by governance to ensure the correct functioning of the network. These parameters range from bonding time to the addresses of contracts that interact with Keep3rV2.

## Bond time
```js
/// @notice Sets the bond time required to activate as a keeper
/// @param _bond The new bond time
function setBondTime(uint256 _bond) external;
```

## Unbond Time
```js
/// @notice Sets the unbond time required unbond what has been bonded
/// @param _unbond The new unbond time
function setUnbondTime(uint256 _unbond) external;
```

## Minimum Liquidity
```js
/// @notice Sets the minimum amount of liquidity required to fund a job
/// @param _liquidityMinimum The new minimum amount of liquidity
function setLiquidityMinimum(uint256 _liquidityMinimum) external;
```

## Reward Period Time
```js
/// @notice Sets the time required to pass between rewards for jobs
/// @param _rewardPeriodTime The new amount of time required to pass between rewards
function setRewardPeriodTime(uint256 _rewardPeriodTime) external;
```

## Inflation Period
```js
/// @notice Sets the new inflation period
/// @param _inflationPeriod The new inflation period
function setInflationPeriod(uint256 _inflationPeriod) external;
```

## Fee
```js
/// @notice Sets the new fee
/// @param _fee The new fee
function setFee(uint256 _fee) external;
```

## KP3R-WETH Pool Address
```js
/// @notice Sets the KP3R-WETH pool address
/// @param _kp3rWethPool The KP3R-WETH pool address
function setkp3rWethPool(address _kp3rWethPool) external;
```

## Keep3rV1Proxy Address
```js
/// @notice Sets the Keep3rV1Proxy address
/// @param _keep3rV1Proxy The Keep3rV1Proxy address
function setKeep3rV1Proxy(address _keep3rV1Proxy) external;
```

## Keep3rV1 Address
```js
/// @notice Sets the Keep3rV1 address
/// @param _keep3rV1 The Keep3rV1 address
function setKeep3rV1(address _keep3rV1) external;
```

## Keep3rHelper Address
```js
/// @notice Sets the Keep3rHelper address
/// @param _keep3rHelper The Keep3rHelper address
function setKeep3rHelper(address _keep3rHelper) external;
```

