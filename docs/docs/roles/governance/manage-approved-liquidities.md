---
sidebar_position: 5
---

# Manage Approved Liquidities

Governance is in charge of approving and removing what liquidity pairs are accepted in the network.

```js
/// @notice Approve a liquidity pair for being accepted in future
/// @param _liquidity The address of the liquidity accepted
function approveLiquidity(address _liquidity) external;
```

```js
/// @notice Revoke a liquidity pair from being accepted in future
/// @param _liquidity The liquidity no longer accepted
function revokeLiquidity(address _liquidity) external;
```
