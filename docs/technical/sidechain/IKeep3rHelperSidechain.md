## `IKeep3rHelperSidechain`

Contains all the helper functions for sidechain keep3r implementations




### `WETH() → address _weth` (external)

Ethereum mainnet WETH address used for quoting references




### `oracle(address _liquidity) → address _oracle` (external)





### `wethUSDPool() → address poolAddress, bool isTKNToken0` (external)

WETH-USD pool that is being used as oracle




### `quoteUsdToEth(uint256 _usd) → uint256 _eth` (external)

Quotes USD to ETH


Used to know how much ETH should be paid to keepers before converting it from ETH to KP3R


### `setOracle(address _liquidity, address _oracle)` (external)

Sets an oracle for a given liquidity


The oracle must contain KP3R as either token0 or token1

### `setWethUsdPool(address _poolAddress)` (external)

Sets an oracle for querying WETH/USD quote


The oracle must contain WETH as either token0 or token1


### `OracleSet(address _liquidity, address _oraclePool)`

The oracle for a liquidity has been saved




### `WethUSDPoolChange(address _address, bool _isWETHToken0)`

Emitted when the WETH USD pool is changed






