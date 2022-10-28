---
sidebar_position: 6
---

# Force Liquidity Credits

Governance can temporarily give liquidity credits to jobs. These liquidity credits will expire after the current [reward period](../../tokenomics/job-payment-mechanisms/credit-mining#reward-periods) has ended.

```js
/// @notice Gifts liquidity credits to the specified job
/// @param _job The address of the job being credited
/// @param _amount The amount of liquidity credits to gift
function forceLiquidityCreditsToJob(address _job, uint256 _amount) external;
```
