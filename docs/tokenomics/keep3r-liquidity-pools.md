# Keep3r Liquidity Pools

## Keep3r Liquidity Provider Tokens

Keep3r Liquidity Provider Tokens, known as`kLP,`are protocol-specific tokens minted to the users that provide liquidity to the network's liquidity pools, also known as pair managers. Jobs can bond `kLP,`which will periodically generate `KP3R` credits for them, which can be used as a form of payment for the keepers that work their job. This is further explained in [Credit Mining](https://app.gitbook.com/@wonderland-1/s/keep3r-v2/~/drafts/-MlAXHGpKjiGu925cyCz/tokenomics/credits/credit-mining).

To achieve this, Keep3rV2 has a factory in charge of creating wrapper contracts designed to  manage the underlying token pairs they wrap. These wrappers or pair managers conform the network's accepted liquidity pools. They provide all the necessary functions to enable the user to get `kLP` in return for their liquidity provision to the underlying token pair, as well as the burning of those `kLP` to recover the liquidity they had previously provided.

The pair manager contracts' name and symbol subscribe to the the following nomenclature:

* Name: `Keep3rLP - token0/token1`.  For example:  `Keep3rLP - KP3R/WETH`
* Symbol: `kLP - token0/token1`.  For example:  `kLP - KP3R/WETH`

## Providing Liquidity

To provide liquidity, users have to approve their chosen pair manager contract to spend their ERC20 tokens and call the pair manager contract's `mint` function. **This function will provide liquidity to the underlying token pair, calculate the corresponding `kLP`owed to the user according to the liquidity they provided, and mint them to whatever address the user has chosen to mint them to**.

To compensate the protocol, the fees generated by the liquidity provided to the underlying token pair will go to governance.

{% hint style="info" %}
**For example**, Alice decides she needs a keeper to work on her job, but at the same time she wants to periodically earn `KP3R`. After doing some research, Alice finds about`kLP`and looks for the pair managers of the Keep3r Network.   
Among them she finds the `kLP - KP3R/WETH`pair manager. She looks for the contract's address, and approves it to spend her `KP3R` and `WETH`. Once all approvals are signed, Alice calls the `mint` function of the`kLP - KP3R/WETH`contract. The contract, in turn, mints her `kLP`, which she can bond in her job to periodically earn`KP3R`. Or, should she have a change of heart, Alice can burn her `kLP`in order to recover the `KP3R` and `WETH`she had provided.
{% endhint %}

```solidity
/// @notice Mints kLP tokens to an address according to the liquidity the msg.sender provides to the UniswapV3 pool
/// @dev Triggers UniV3PairManager#uniswapV3MintCallback
/// @param amount0Desired The amount of token0 we would like to provide
/// @param amount1Desired The amount of token1 we would like to provide
/// @param amount0Min The minimum amount of token0 we want to provide
/// @param amount1Min The minimum amount of token1 we want to provide
/// @param to The address to which the kLP tokens are going to be minted to
/// @return liquidity kLP tokens sent in exchange for the provision of tokens
function mint(
  uint256 amount0Desired,
  uint256 amount1Desired,
  uint256 amount0Min,
  uint256 amount1Min,
  address to
) external returns (uint128 liquidity);
```

## Burning Liquidity

Liquidity providers can choose to burn their `kLP` in order to collect the liquidity they had previously provided. To do this, they must call the `burn` function.

{% hint style="danger" %}
**Only an address that holds kLP can call the burn function, otherwise it will revert.**
{% endhint %}

```solidity
/// @notice Burns the corresponding amount of kLP tokens from the msg.sender and withdraws the specified liquidity
//          in the entire range
/// @param liquidity The amount of liquidity to be burned
/// @param amount0Min The minimum amount of token0 we want to send to the recipient (to)
/// @param amount1Min The minimum amount of token1 we want to send to the recipient (to)
/// @param to The address that will receive the due fees
/// @return amount0 The calculated amount of token0 that will be sent to the recipient
/// @return amount1 The calculated amount of token1 that will be sent to the recipient
function burn(
  uint128 liquidity,
  uint256 amount0Min,
  uint256 amount1Min,
  address to
) external returns (uint256 amount0, uint256 amount1);
```

## Transfer kLP

If a user wishes to transfer his kLP to another address, the user can call the `transfer` function.

```solidity
/// @notice Transfer kLP from the caller to another address
/// @param to The address that will receive the kLP
/// @param amount The amount of kLP to be sent
function transfer(address to, uint256 amount) external returns (bool)
```

## Approve User to Spend my kLP

If a user has deposited liquidity in a pair manager and wants to approve another address to spend her `kLP`, all the user has to do is call the pair manager's `approve` function.

```solidity
/// @notice Approves another address to spend the caller's kLP
/// @param spender The address allowed to spend the caller's kLP
/// @param amount The amount of kLP the spender will be able to spend
function approve(address spender, uint256 amount) external returns (bool);
```

{% hint style="info" %}
To execute `addLiquidityToJob` the provider needs first to approve the spending for the Keep3r address
{% endhint %}

## Position

The pair manager contracts include a function that allows anyone to check the pair manager's position in the underlying token pair.

```solidity
/// @notice Returns the pair manager's position in the corresponding UniswapV3 pool
/// @return liquidity The amount of liquidity provided to the UniswapV3 pool by the pair manager
/// @return feeGrowthInside0LastX128 The fee growth of token0 as of the last action on the individual position
/// @return feeGrowthInside1LastX128 The fee growth of token1 as of the last action on the individual position
/// @return tokensOwed0 The uncollected amount of token0 owed to the position as of the last computation
/// @return tokensOwed1 The uncollected amount of token1 owed to the position as of the last computation
function position()
  external
  view
  returns (
    uint128 liquidity,
    uint256 feeGrowthInside0LastX128,
    uint256 feeGrowthInside1LastX128,
    uint128 tokensOwed0,
    uint128 tokensOwed1
  );
```
