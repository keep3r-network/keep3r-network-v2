# Jobs

## Quick Start Examples

### Simple Keeper

To setup a keeper function simply add the following modifier in your contract:

```text
modifier validateAndPayKeeper(address _keeper) {
  if (!IKeep3r(keep3r).isKeeper(_keeper)) revert KeeperNotValid();
  _;
  IKeep3r(keep3r).worked(_keeper);
}
```

It could be then implement it like this:

```text
function work() external validateAndPayKeeper(msg.sender) {
  // ...
}
```

The above will make sure the caller is a registered keeper as well as reward them with an amount of KP3R equal to their gas spent + premium. Make sure to have enough credits assigned in the Keep3r system for the relevant job.

## Adding Jobs

Jobs can be created directly via [`addJob()`](https://github.com/defi-wonderland/keep3r-v2-public/blob/public/contracts/peripherals/jobs/Keep3rJobManager.sol).

```text
  /// @notice Allows any caller to add a new job
  /// @param _job Address of the contract for which work should be performed
  function addJob(address _job) external;
```

## Managing Credits

Jobs need credit to be able to pay keepers, this credit can either be paid for directly \(see [Token Payments](../tokenomics/job-payment-mechanisms/token-payments.md)\), or by being a liquidity provider \(see [Credit Mining](../tokenomics/job-payment-mechanisms/credit-mining.md)\) in the system. If you pay directly, this is a direct expense, if you are a liquidity provider, you get all your liquidity back after you are done being a provider.

### Start mining credits for your job via Liquidity

To start mining credits, you will need to provide [LP tokens](../tokenomics/keep3r-liquidity-pools.md) as liquidity by calling [`addLiquidityToJob()`](https://github.com/defi-wonderland/keep3r-v2-public/blob/public/contracts/interfaces/peripherals/IKeep3rJobs.sol). You receive all your LP tokens back when you no longer need to provide credit for a contract.

```text
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

### Remove liquidity from a job

To remove your liquidity from a job, you will need to call [`unbondLiquidityFromJob()`](https://github.com/defi-wonderland/keep3r-v2-public/blob/public/contracts/interfaces/peripherals/IKeep3rJobs.sol) 

```text
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

Wait `UNBOND` \(default 14 days\) days and call [`withdrawLiquidityFromJob()`](https://github.com/defi-wonderland/keep3r-v2-public/blob/public/contracts/interfaces/peripherals/IKeep3rJobs.sol)\`\`

```text
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

### Adding credits directly \(non ETH\)

To add Token Credits to your job, you will need to call [`addTokenCreditsToJob()`](https://github.com/defi-wonderland/keep3r-v2-public/blob/public/contracts/interfaces/peripherals/IKeep3rJobs.sol). 

{% hint style="info" %}
Adding KP3R tokens is not allowed this way, the only way is via liquidity mining.
{% endhint %}

```text
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

## Selecting Keepers

Dependent on your requirements you might allow any keepers, or you want to limit specific keepers, you can filter keepers based on `age`, `bond`, `total earned funds`, or even arbitrary values such as additional bonded tokens.

### No access control

Accept all keepers in the system.

```text
/// @notice Confirms if the current keeper is registered, can be used for general (non critical) functions
/// @param _keeper The keeper being investigated
/// @return _isKeeper Whether the address passed as a parameter is a keeper or not
function isKeeper(address _keeper) external returns (bool _isKeeper);
```

### Filtered access control

Filter keepers based on bonded amount of tokens, earned funds, and age in system. For example a keeper might need to have `SNX` to be able to participate in the [Synthetix](https://synthetix.io/) ecosystem.

```text
/// @notice Confirms if the current keeper is registered and has a minimum bond of any asset. Should be used for protected functions
/// @param _keeper The keeper to check
/// @param _bond The bond token being evaluated
/// @param _minBond The minimum amount of bonded tokens
/// @param _earned The minimum funds earned in the keepers lifetime
/// @param _age The minimum keeper age required
/// @return _isBondedKeeper Whether the `_keeper` meets the given requirements
function isBondedKeeper(
  address _keeper,
  address _bond,
  uint256 _minBond,
  uint256 _earned,
  uint256 _age
) external returns (bool _isBondedKeeper);
```

## Paying Keepers

There are two primary payment mechanisms and these are based on the credit provided;

* Pay via liquidity provided tokens \(based on `addLiquidityToJob`\)
* Pay in direct token \(based on `addTokenCreditsToJob`\)

## Auto Pay

### Pay for Work

If you don't want to worry about calculating payment, you can simply let the system calculate the recommended payment itself.

```text
/// @notice Implemented by jobs to show that a keeper performed work
/// @dev Automatically calculates the payment for the keeper
/// @param _keeper Address of the keeper that performed the work
function worked(address _keeper) external;
```

### Pay with KP3R

```text
/// @notice Implemented by jobs to show that a keeper performed work
/// @dev Pays the keeper that performs the work with KP3R
/// @param _keeper Address of the keeper that performed the work
/// @param _payment The reward that should be allocated for the job
function bondedPayment(address _keeper, uint256 _payment) external;
```

### Pay with an ERC20 token

```text
/// @notice Implemented by jobs to show that a keeper performed work
/// @dev Pays the keeper that performs the work with a specific token
/// @param _token The asset being awarded to the keeper
/// @param _keeper Address of the keeper that performed the work
/// @param _amount The reward that should be allocated
function directTokenPayment(
  address _token,
  address _keeper,
  uint256 _amount
) external;
```

## Job Migration

There may be situations where a job needs to migrate all of their "assets" to another contract address, for a job update for example. A proper migration implies the accountancy \(tokens, liquidities, period credits\) from the original job address will be transferred to the new one. This process is possible, and it requires the job to call two functions:

* `migrateJob`first to start the migration process. This function should be call by the owner of the job that currently holds the assets to migrate.

```text
/// @notice Initializes the migration process for a job by adding the request to the pendingJobMigrations mapping
/// @param _fromJob The address of the job that is requesting to migrate
/// @param _toJob The address at which the job is requesting to migrate
function migrateJob(address _fromJob, address _toJob) external;
```

* `acceptJobMigration` to complete the migration process. This function should be call by the owner of the job that will receive the assets to migrate.

```text
/// @notice Completes the migration process for a job
/// @dev Unbond/withdraw process doesn't get migrated
/// @param _fromJob The address of the job that requested to migrate
/// @param _toJob The address to which the job wants to migrate to
function acceptJobMigration(address _fromJob, address _toJob) external;
```

There are some considerations the job wishing to migrate must take into account to prevent the functions from reverting:

* It must not provide its current address as the address where it wants to migrate to when calling `migrateJob`
* Calls to both `migrateJob` and `acceptJobMigration` should be done with the same arguments. 
* Neither of the jobs involved in the migration process should be disputed
* It must wait at least one minute between migrations

Here's a graphic representation to visualize the resulting changes in the credits of a job that goes through a successful migration.

![](./img/jobmigration.png)



