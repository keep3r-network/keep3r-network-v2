## `IUniV3PairManager`

Creates a UniswapV3 position, and tokenizes in an ERC20 manner
        so that the user can use it as liquidity for a Keep3rJob




### `fee() → uint24 _fee` (external)

The fee of the Uniswap pool passed into the constructor




### `tickUpper() → int24 _tickUpper` (external)

Highest tick in the Uniswap's curve




### `tickLower() → int24 _tickLower` (external)

Lowest tick in the Uniswap's curve




### `tickSpacing() → int24 _tickSpacing` (external)

The pair tick spacing




### `sqrtRatioAX96() → uint160 _sqrtPriceA96` (external)

The sqrtRatioAX96 at the lowest tick (-887200) of the Uniswap pool




### `sqrtRatioBX96() → uint160 _sqrtPriceBX96` (external)

The sqrtRatioBX96 at the highest tick (887200) of the Uniswap pool




### `uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes data)` (external)

This function is called after a user calls IUniV3PairManager#mint function
        It ensures that any tokens owed to the pool are paid by the msg.sender of IUniV3PairManager#mint function




### `mint(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) → uint128 liquidity` (external)

Mints kLP tokens to an address according to the liquidity the msg.sender provides to the UniswapV3 pool


Triggers UniV3PairManager#uniswapV3MintCallback


### `position() → uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1` (external)

Returns the pair manager's position in the corresponding UniswapV3 pool




### `collect() → uint256 amount0, uint256 amount1` (external)



The collected fees will be sent to governance


### `burn(uint128 liquidity, uint256 amount0Min, uint256 amount1Min, address to) → uint256 amount0, uint256 amount1` (external)







### `MintCallbackData`


struct PoolAddress.PoolKey _poolKey


address payer



