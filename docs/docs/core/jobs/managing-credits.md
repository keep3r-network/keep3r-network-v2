---
sidebar_position: 4
---

# Managing Credits
Jobs need to have credits to be able to pay keepers for their work. Currently, there are two ways to assign credits to your job: Credit mining through liquidity providing and  Direct deposit of a token.
The method to use will be dictated by the token you choose as payment.

## Pay in KP3R: Mining credits
#### Add liquidity to LP pool
To start mining credits, you will need to provide [LP tokens](../../tokenomics/keep3r-liquidity-pools) as liquidity by calling [`addLiquidityToJob()`](https://github.com/keep3r-network/keep3r-network-v2/blob/main/solidity/interfaces/peripherals/IKeep3rJobs.sol). This is the most powerful method to add credits to a job and the one we recommend using. You will find an in-depth explanation in our [Keep3r Liquidity Pools section](../../tokenomics/keep3r-liquidity-pools).

```js
  /// @notice Allows anyone to fund a job with liquidity
  /// @param _job The address of the job to assign liquidity to
  /// @param _liquidity The liquidity being added
  /// @param _amount The amount of liquidity tokens to add
  function addLiquidityToJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external;
```

#### Remove liquidity from a job
If at some point, you decide that you don't want to keep maintaining a job, you can remove your provided liquidity and get your tokens back. Removing your liquidity from a job is a two steps process:
1. You will need to unbond your LP tokens using the [`unbondLiquidityFromJob()`](https://github.com/keep3r-network/keep3r-network-v2/blob/main/solidity/interfaces/peripherals/IKeep3rJobs.sol) function.
```js
  /// @notice Unbond liquidity for a job
  /// @dev Can only be called by the job's owner
  /// @param _job The address of the job being unbound from
  /// @param _liquidity The liquidity being unbound
  /// @param _amount The amount of liquidity being removed
  function unbondLiquidityFromJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external;
```
2. Once unbonded you will need to wait a period of time to be able to withdraw that amount. (default 14 days)
3. Once unbond time is over, you will be able to withdraw your Tokens using the [`withdrawLiquidityFromJob()`](https://github.com/keep3r-network/keep3r-network-v2/blob/main/solidity/interfaces/peripherals/IKeep3rJobs.sol) function.
```js
  /// @notice Withdraw liquidity from a job
  /// @param _job The address of the job being withdrawn from
  /// @param _liquidity The liquidity being withdrawn
  /// @param _receiver The address that will receive the withdrawn liquidity
  function withdrawLiquidityFromJob(
    address _job,
    address _liquidity,
    address _receiver
  ) external;
```

## Pay in ERC20: Adding credits directly (non ETH)
To add Token Credits to your job, you must use the [`addTokenCreditsToJob()`](https://github.com/keep3r-network/keep3r-network-v2/blob/main/solidity/interfaces/peripherals/IKeep3rJobs.sol) function. This is in case you want to pay your keepers with ERC20 tokens (except KP3R).

Something important to point out is that this method is a direct expense, meaning that you won't be getting your credit back. This is opposite to what happens when credit farming, where you will be able to get your provided liquidity back.

:::info
Adding KP3R tokens is not allowed this way, the only way is via liquidity mining.
:::
```js
  /// @notice Add credit to a job to be paid out for work
  /// @param _job The address of the job being credited
  /// @param _token The address of the token being credited
  /// @param _amount The amount of credit being added
  function addTokenCreditsToJob(
    address _job,
    address _token,
    uint256 _amount
  ) external;
```