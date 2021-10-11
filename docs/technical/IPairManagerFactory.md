## `IPairManagerFactory`

This contract creates new pair managers




### `pairManagers(address _pool) → address _pairManager` (external)

Maps the address of a Uniswap pool, to the address of the corresponding PairManager
        For example, the uniswap address of DAI-WETH, will return the Keep3r/DAI-WETH pair manager address




### `createPairManager(address _pool) → address _pairManager` (external)

Creates a new pair manager based on the address of a Uniswap pool
        For example, the uniswap address of DAI-WETH, will create the Keep3r/DAI-WETH pool





### `PairCreated(address _pool, address _pairManager)`

Emitted when a new pair manager is created






