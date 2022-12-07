# Token Payments

Jobs as well can top-up their credits with ERC20 tokens, and then use them to reward keepers.

## Add Tokens To Job

Anyone can add token credits to a job by approving a transfer of an ERC20 token and then calling:

```solidity
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

This function will give the job token credits in a 1:1 relation to the transferred ERC20 tokens. Job token credit balance can be checked calling:

```solidity
/// @notice The current token credits available for a job
/// @return _amount The amount of token credits available for a job
function jobTokenCredits(address _job, address _token) external view returns (uint256 _amount);
```

{% hint style="danger" %}
The only way of adding KP3R credits to a job is by [Credit Mining](credit-mining.md). Trying to add KP3R tokens by using `addTokenCreditsToJob` will revert.
{% endhint %}

## Withdraw Tokens From Job

A job owner can withdraw tokens credits from a job by calling:

```solidity
/// @notice Withdraw credit from a job
/// @param _job The address of the job from which the credits are withdrawn
/// @param _token The address of the token being withdrawn
/// @param _amount The amount of token to be withdrawn
/// @param _receiver The user that will receive tokens
function withdrawTokenCreditsFromJob(
  address _job,
  address _token,
  uint256 _amount,
  address _receiver
) external;
```

This function can revert if:

* Job is disputed
* Token credits were added to the job at most 1 minute before trying to withdraw

## Pay Keepers With Token Credits

In order to reward keepers for their work with token credits jobs can call:

```solidity
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
