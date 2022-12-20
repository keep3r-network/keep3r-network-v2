# Slasher

Slashers are governance-approved addresses with permission to exercise last resort punishments over keepers and jobs that act in bad faith. These permissions allow slashers to:

* Slash bonded assets from keepers
* Slash tokens and liquidities from jobs
* Blacklist keepers altogether, effectively rendering them unable to keep participating in the network.

> For a keeper or a job to be subjected to a possible slashing or blacklist, they have first to have been disputed by either governance or a disputer.

## Slashing Keepers

Slash the bonded asset of a keeper.

```solidity
/// @notice Allows governance to slash a keeper based on a dispute
/// @param _keeper The address being slashed
/// @param _bonded The asset being slashed
/// @param _amount The amount being slashed
function slash(
  address _keeper,
  address _bonded,
  uint256 _amount
) external;
```

## Slashing Jobs

Slash an array of tokens from a job.

```solidity
/// @notice Allows governance or slasher to slash a job specific token
/// @param _job The address of the job from which the token will be slashed
/// @param _tokens An array containing the token addresses that will be slashed
/// @param _amounts An array containing the amounts of token that will be slashed for each token
function slashTokenFromJob(
  address _job,
  address[] memory _tokens,
  uint256[] memory _amounts
) external;
```

Slash an array of liquidities from a job.

```solidity
/// @notice Allows governance or a slasher to slash liquidity from a job
/// @param _job The address being slashed
/// @param _liquidities An array containing the liquidity addresses that will be slashed
/// @param _amounts An array containing the amounts of liquidity that will be slashed for each liquidity
function slashLiquidityFromJob(
  address _job,
  address[] memory _liquidities,
  uint256[] memory _amounts
) external;
```

## Blacklisting Keepers

Blacklists a keeper from the network.

```solidity
/// @notice Blacklists a keeper from participating in the network
/// @param _keeper The address being slashed
function revoke(address _keeper) external;
```
