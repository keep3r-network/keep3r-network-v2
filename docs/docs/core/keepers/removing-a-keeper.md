---
sidebar_position: 3
---

# Removing a Keeper

If you want to withdraw your bonds, you will need first to unbond them.

```js
/// @notice Beginning of the unbonding process
/// @param _bonding The asset being unbound
/// @param _amount Allows for partial unbonding
function unbond(address _bonding, uint256 _amount) external;
```

:::info
After a keeper has unbonded an asset amount, it may stop qualifying for the Filtered Access Control jobs, should they require to have bondings of that asset
:::

After waiting `unbondTime` (default 14 days) you can withdraw any bonded assets

```js
/// @notice Withdraw funds after unbonding has finished
/// @param _bonding The asset to withdraw from the bonding pool
function withdraw(address _bonding) external;
```

Note: Some jobs might have additional requirements such as minimum bonded protocol tokens (for example `SNX`). In such cases you would need to bond a minimum amount of `SNX` before you may qualify for the job.