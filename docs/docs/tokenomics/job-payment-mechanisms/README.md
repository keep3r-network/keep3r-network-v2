---
sidebar_position: 1
---
# Job Payment Mechanisms

There are 2 ways for a Job Manager to pay keepers to upkeep their job:

* Credit Mining
* Token Payments

## [Credit Mining](./credit-mining.md)

A Job can pay their keepers via credits obtained by Credit Mining.

The Credit Mining mechanism allows anyone to provide liquidity on a [Keep3r Liquidity Pool](../keep3r-liquidity-pools/README.md) \(kLP\) and stake their kLP tokens on the [Keep3rJobFundableLiquidity](../../technical/peripherals/IKeep3rJobFundableLiquidity.md) contract in order to start the mining of KP3R credits.

The credits mined can only be used to pay for job works within the network and can't be withdrawn. 

Similar to [Jobs](../../core/jobs/README.md) & [Keepers](../../core/keepers/README.md), the credits can be slashed and/or revoked via the Slasher or Governance.

## [Token Payments](./token-payments.md)

A Job can pay their keepers via token payments.

The token payment mechanism allows anyone to deposit ERC20s and set a rate of which they want to perform the payouts for the upkeep of their jobs.

Job Managers can also add on [`directTokenPayment()`](../../technical/peripherals/IKeep3rJobWorkable.md) and [`worked()`](../../technical/peripherals/IKeep3rJobWorkable.md) functions on their jobs, in order for the protocol to auto-calculate their job payouts based on the amount of gas spent on the particular upkeep transaction.

Similar to [Jobs](../../core/jobs/README.md) & [Keepers](../../core/keepers/README.md), the credits can be slashed and/or revoked via the Slasher or Governance.



