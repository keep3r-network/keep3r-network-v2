# Keepers

Keepers are bots, scripts, other contracts, or simply EOA accounts that trigger events. This can be submitting a signed TX on behalf of a third party, calling a transaction at a specific time, or a more complex functionality.

Each time you execute such a function, you are rewarded in either tokens, or the systems native token KP3R.

Jobs might require keepers that have a minimum amount of bonded tokens, have earned a minimum amount of fees, or have been in the system longer than a certain period of time.

At the most simple level, they simply require a keeper to be registered in the system.

## Becoming a Keeper

To become a keeper, you simply need to call `bond(address,uint)`, no funds are required to become a keeper, however certain jobs might require a minimum amount of funds.

```solidity
/// @notice Beginning of the bonding process
/// @param _bonding The asset being bound
/// @param _amount The amount of bonding asset being bound
function bond(address _bonding, uint256 _amount) external;
```

After waiting `bondTime` \(default 3 days\) and you can activate as a keeper;

```solidity
/// @notice End of the bonding process after bonding time has passed
/// @param _bonding The asset being activated as bond collateral
function activate(address _bonding) external;
```

## Removing a Keeper

If you want to withdraw your bonds, you will need first to unbond them,

```solidity
/// @notice Beginning of the unbonding process
/// @param _bonding The asset being unbound
/// @param _amount Allows for partial unbonding
function unbond(address _bonding, uint256 _amount) external;
```

{% hint style="info" %}
After a keeper has unbonded an asset amount, it may stop qualifying for the Filtered Access Control jobs, should they require to have bondings of that asset
{% endhint %}

After waiting `unbondTime` \(default 14 days\) you can withdraw any bonded assets

```solidity
/// @notice Withdraw funds after unbonding has finished
/// @param _bonding The asset to withdraw from the bonding pool
function withdraw(address _bonding) external;
```

## Additional Requirements

Some jobs might have additional requirements such as minimum bonded protocol tokens \(for example SNX\). In such cases you would need to bond a minimum amount of SNX before you may qualify for the job.
