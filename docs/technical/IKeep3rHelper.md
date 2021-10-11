## `IKeep3rHelper`

Contains all the helper functions used throughout the different files.




### `KP3R() → address _kp3r` (external)

Address of KP3R token




### `KP3R_WETH_POOL() → address _kp3rWeth` (external)

Address of KP3R-WETH pool to use as oracle




### `MIN() → uint256 _multiplier` (external)

The minimum multiplier used to calculate the amount of gas paid to the Keeper for the gas used to perform a job
        For example: if the quoted gas used is 1000, then the minimum amount to be paid will be 1000 * MIN / BOOST_BASE




### `MAX() → uint256 _multiplier` (external)

The maximum multiplier used to calculate the amount of gas paid to the Keeper for the gas used to perform a job
        For example: if the quoted gas used is 1000, then the maximum amount to be paid will be 1000 * MAX / BOOST_BASE




### `BOOST_BASE() → uint256 _base` (external)

The boost base used to calculate the boost rewards for the keeper




### `TARGETBOND() → uint256 _target` (external)

The targeted amount of bonded KP3Rs to max-up reward multiplier
        For example: if the amount of KP3R the keeper has bonded is TARGETBOND or more, then the keeper will get
                     the maximum boost possible in his rewards, if it's less, the reward boost will be proportional




### `quote(uint256 _eth) → uint256 _amountOut` (external)

Calculates the amount of KP3R that corresponds to the ETH passed into the function


This function allows us to calculate how much KP3R we should pay to a keeper for things expressed in ETH, like gas


### `bonds(address _keeper) → uint256 _amountBonded` (external)

Returns the amount of KP3R the keeper has bonded




### `getRewardAmountFor(address _keeper, uint256 _gasUsed) → uint256 _kp3r` (external)

Calculates the reward (in KP3R) that corresponds to a keeper for using gas




### `getRewardBoostFor(uint256 _bonds) → uint256 _rewardBoost` (external)

Calculates the boost in the reward given to a keeper based on the amount of KP3R that keeper has bonded




### `getRewardAmount(uint256 _gasUsed) → uint256 _amount` (external)

Calculates the reward (in KP3R) that corresponds to tx.origin for using gas




### `getPoolTokens(address _pool) → address _token0, address _token1` (external)

Given a pool address, returns the underlying tokens of the pair




### `isKP3RToken0(address _pool) → bool _isKP3RToken0` (external)

Defines the order of the tokens in the pair for twap calculations




### `observe(address _pool, uint32[] _secondsAgo) → int56 _tickCumulative1, int56 _tickCumulative2, bool _success` (external)

Given an array of secondsAgo, returns UniswapV3 pool cumulatives at that moment




### `getKP3RsAtTick(uint256 _liquidityAmount, int56 _tickDifference, uint256 _timeInterval) → uint256 _kp3rAmount` (external)

Given a tick and a liquidity amount, calculates the underlying KP3R tokens




### `getQuoteAtTick(uint256 _baseAmount, int56 _tickDifference, uint256 _timeInterval) → uint256 _quoteAmount` (external)

Given a tick and a token amount, calculates the output in correspondant token







