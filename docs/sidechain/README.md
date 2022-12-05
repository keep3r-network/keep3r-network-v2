# Keep3r Sidechain

### Wrapped assets
Sidechain implementations of Keep3r will use a wrapped version of both KP3R (`wKP3R`) token and kLPs (`wkLP`) to work. These wrapped assets are minted by the bridge providers, and not natively minted by the protocol. To mimic mainnet native minting, funds will be transferred periodically from mainnet to the sidechain, and deposited on an escrow contract ['Keep3rEscrow'](../technical/sidechain/IKeep3rEscrow.md).
> To keep interface compatibility, as these contracts mimic their mainnet implementation, `wKP3R` will be stored in `keep3rV1` storage slot, and `Keep3rEscrow` in `keep3rV1Proxy`.

`Keep3rSidechain` incorporates a `virtualReserves` view method, that indicates how many surplus `wKP3R` credits are still available on the escrow to emit rewards.

```solidity
function virtualReserves() external view override returns (int256 _virtualReserves) {
  // Queries wKP3R balanceOf escrow contract minus the totalBonds
  return int256(IERC20(keep3rV1).balanceOf(keep3rV1Proxy)) - int256(totalBonds);
}
```

> Warning: Keepers should check before working a job that there are enough virtualReserves to pay them. When there are no virtualReserves (value is 0 or negative), transaction won't revert and keepers will still receive credits in reward, but they risk not being able to withdraw them.

While `wKP3R` must be unique for each chain implementation, liquidity tokens can support multiple wrapped versions of the same asset, `A-wkLP` and `B-wkLP` can exist, be approved, and work as 2 different liquidities with the same oracle. This facilitates efficiently bridging from multiple providers, or from different origins, while all the liquidity these wrapped assets represent, will be held on a UniV3 full-range `KP3R-WETH(1%)` position on Ethereum mainnet.

Keepers who receive `wKP3Rs` in rewards can bridge them back to Ethereum mainnet to withdraw the unwrapped versions of the assets (`KP3Rs`).

### Job Credits

A Job can generate new credits with time, by minting Keep3r Liquidity Pool tokens `kLP` in mainnet (similar to Keep3r mainnet implementation), then bridging the tokens to the desired chain, and staking the `wkLPs` into the sidechain implementation. Once `wkLPs` are added to a job (read [`credit-minting`](../tokenomics/job-payment-mechanisms/credit-mining.md), the job starts immediately to mine new `wKP3R` credits, that can be collectable only by the keepers, in reward for working the job. The credit mining system requires no further action from the job owner.

### Job Payment

Some of the few consideration of sidechain implamentation are:
- Earning a percentage of the gas costs may result uninteresting
- Earnings may not suffice to cover the fixed costs for keepers
- Gas prices are less stable and more prone to spike

To improve keepers profitability and stabilize their income expectation, jobs in sidechain implementations will reward keepers on a stable `USD/gasUnit`, that means, that the payment is not dependant on the gas price of the transaction, but on the amount of gas units it spends.

Jobs need to implement a new method `worked(address _keeper, uint256 _usdPerGasUnit)`, providing the amount of $USD (18 decimals) per gas unit they want to reward (twap quoted equivalent in `wKP3Rs`) for executing the task. Jobs will choose to overpay gas costs to incentivize keepers to maintain them, and keepers will have a broad margin to disesteem gas costs of the execution. Jobs will reward only gas costs expended on their task, and Keep3r internal calculations and state changes will not be rewarded to keepers.

```solidity

function worked(address) external pure override {
  revert Deprecated();
}

/// @dev Uses a USD per gas unit payment mechanism
/// @param _keeper Address of the keeper that performed the work
/// @param _usdPerGasUnit Units of USD (in wei) per gas unit that should be rewarded to the keeper
function worked(address _keeper, uint256 _usdPerGasUnit) external override {
  // Gas used for quote calculations & payment is not rewarded
  uint256 _gasRecord = _getGasLeft();
  ...
```


### Oracles

Keep3r sidechain implementation will rely on a [`SidechainOracles`](https://github.com/defi-wonderland/sidechain-oracles) deployment to provision the `KP3R-ETH` quote from mainnet. The oracle consists in a -`IUniV3Pool` compatible- storage contract on the sidechain, and a `Keep3rJob` contract to sync the state from Ethereum mainnet. In this way, `KP3R-ETH` liquidity can be preserved on mainnet avoiding the fragmentation of it. To quote $USD equivalent to `wKP3Rs`, `Keep3rHelperSidechain` requires a 2nd oracle (appart from `KP3R-WETH`), being `WETH-USD`, being `USD` any USD stable coin with 18 decimals. The `WETH-USD` oracle can be either a preexisting `UniV3Pool` with healthy liquidity, or a `SidechainOracles` pipeline from a convenient origin.

For jobs, liquidities will be quoted once a period, defining the amount of credits they will mint. And for keepers, credits will be quoted on each transaction, using a twap observation for both oracles.
