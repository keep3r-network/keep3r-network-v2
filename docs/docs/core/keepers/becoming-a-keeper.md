---
sidebar_position: 2
---

# Becoming a Keeper

To become a keeper, you need to call `bond(address,uint)`, wait the required amount of time (default 3 days), and call the `activate(address)` method. 

No funds are needed to become a keeper, however, certain jobs might require a minimum amount. If you don't want to bond any funds, you will call the `bond(address,uint)` method passing any ERC20 token as `bonding` and zero as the `amount`. You will still be required to wait for the bonding period to wear off.

```js
/// @notice Beginning of the bonding process
/// @param _bonding The asset being bound
/// @param _amount The amount of bonding asset being bound
function bond(address _bonding, uint256 _amount) external;
```
```js
/// @notice End of the bonding process after bonding time has passed
/// @param _bonding The asset being activated as bond collateral
function activate(address _bonding) external;
```

Note: Some jobs might have additional requirements such as minimum bonded protocol tokens (for example `SNX`). In such cases you would need to bond a minimum amount of `SNX` before you may qualify for the job.