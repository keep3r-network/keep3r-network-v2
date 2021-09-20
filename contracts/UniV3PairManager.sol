// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './libraries/LiquidityAmounts.sol';
import './libraries/PoolAddress.sol';
import './libraries/FixedPoint96.sol';
import './libraries/FullMath.sol';
import './libraries/TickMath.sol';

import './interfaces/external/IWeth9.sol';
import './interfaces/IUniV3PairManager.sol';

import './peripherals/Governable.sol';

contract UniV3PairManager is IUniV3PairManager, Governable {
  string public override name;
  string public override symbol;
  uint256 public override totalSupply = 0;

  address public immutable override token0;
  address public immutable override token1;
  address public immutable override pool;
  uint24 public immutable override fee;
  uint160 public immutable override sqrtRatioAX96;
  uint160 public immutable override sqrtRatioBX96;

  int24 private constant _TICK_LOWER = -887200;
  int24 private constant _TICK_UPPER = 887200;
  //solhint-disable-next-line const-name-snakecase
  uint8 public constant override decimals = 18;

  mapping(address => mapping(address => uint256)) public override allowance;
  mapping(address => uint256) public override balanceOf;

  IWeth9 private constant _WETH = IWeth9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

  PoolAddress.PoolKey private _poolKey;

  constructor(address _pool, address _governance) Governable(_governance) {
    pool = _pool;
    uint24 _fee = IUniswapV3Pool(_pool).fee();
    fee = _fee;
    address _token0 = IUniswapV3Pool(_pool).token0();
    address _token1 = IUniswapV3Pool(_pool).token1();
    token0 = _token0;
    token1 = _token1;
    name = string(abi.encodePacked('Keep3rV1 - ', ERC20(_token0).symbol(), '/', ERC20(_token1).symbol()));
    symbol = string(abi.encodePacked('kLP-', ERC20(_token0).symbol(), '/', ERC20(_token1).symbol()));
    sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(_TICK_LOWER);
    sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(_TICK_UPPER);
    _poolKey = PoolAddress.PoolKey({token0: _token0, token1: _token1, fee: _fee});
  }

  // this low-level function should be called from a contract which performs important safety checks
  function mint(
    uint256 amount0Desired,
    uint256 amount1Desired,
    uint256 amount0Min,
    uint256 amount1Min,
    address to
  ) external override returns (uint128 liquidity) {
    (liquidity, , ) = _addLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
    _mint(to, liquidity);
  }

  function uniswapV3MintCallback(
    uint256 amount0Owed,
    uint256 amount1Owed,
    bytes calldata data
  ) external override {
    MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
    if (msg.sender != pool) revert OnlyPool();
    if (amount0Owed > 0) _pay(decoded._poolKey.token0, decoded.payer, pool, amount0Owed);
    if (amount1Owed > 0) _pay(decoded._poolKey.token1, decoded.payer, pool, amount1Owed);
  }

  function burn(
    uint128 liquidity,
    uint256 amount0Min,
    uint256 amount1Min,
    address to
  ) external override returns (uint256 amount0, uint256 amount1) {
    (amount0, amount1) = IUniswapV3Pool(pool).burn(_TICK_LOWER, _TICK_UPPER, liquidity);

    if (amount0 < amount0Min || amount1 < amount1Min) revert ExcessiveSlippage();

    IUniswapV3Pool(pool).collect(to, _TICK_LOWER, _TICK_UPPER, uint128(amount0), uint128(amount1));
    _burn(msg.sender, liquidity);
  }

  function collect() external override onlyGovernance returns (uint256 amount0, uint256 amount1) {
    (, , , uint128 tokensOwed0, uint128 tokensOwed1) = IUniswapV3Pool(pool).positions(
      keccak256(abi.encodePacked(address(this), _TICK_LOWER, _TICK_UPPER))
    );
    (amount0, amount1) = IUniswapV3Pool(pool).collect(governance, _TICK_LOWER, _TICK_UPPER, tokensOwed0, tokensOwed1);
  }

  function position()
    external
    view
    override
    returns (
      uint128 liquidity,
      uint256 feeGrowthInside0LastX128,
      uint256 feeGrowthInside1LastX128,
      uint128 tokensOwed0,
      uint128 tokensOwed1
    )
  {
    (liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1) = IUniswapV3Pool(pool).positions(
      keccak256(abi.encodePacked(address(this), _TICK_LOWER, _TICK_UPPER))
    );
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    allowance[msg.sender][spender] = amount;

    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transfer(address dst, uint256 amount) external override returns (bool) {
    _transferTokens(msg.sender, dst, amount);
    return true;
  }

  function transferFrom(
    address src,
    address dst,
    uint256 amount
  ) external override returns (bool) {
    address spender = msg.sender;
    uint256 spenderAllowance = allowance[src][spender];

    if (spender != src && spenderAllowance != type(uint256).max) {
      uint256 newAllowance = spenderAllowance - amount;
      allowance[src][spender] = newAllowance;

      emit Approval(src, spender, newAllowance);
    }

    _transferTokens(src, dst, amount);
    return true;
  }

  /// @notice Add liquidity to an initialized pool
  function _addLiquidity(
    uint256 amount0Desired,
    uint256 amount1Desired,
    uint256 amount0Min,
    uint256 amount1Min
  )
    internal
    returns (
      uint128 liquidity,
      uint256 amount0,
      uint256 amount1
    )
  {
    (uint160 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(pool).slot0();

    liquidity = LiquidityAmounts.getLiquidityForAmounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, amount0Desired, amount1Desired);

    (amount0, amount1) = IUniswapV3Pool(pool).mint(
      address(this),
      _TICK_LOWER,
      _TICK_UPPER,
      liquidity,
      abi.encode(MintCallbackData({_poolKey: _poolKey, payer: msg.sender}))
    );

    if (amount0 < amount0Min || amount1 < amount1Min) revert ExcessiveSlippage();
  }

  function _pay(
    address token,
    address payer,
    address recipient,
    uint256 value
  ) internal {
    _safeTransferFrom(token, payer, recipient, value);
  }

  function _mint(address dst, uint256 amount) internal {
    totalSupply += amount;
    balanceOf[dst] += amount;
    emit Transfer(address(0), dst, amount);
  }

  function _burn(address dst, uint256 amount) internal {
    totalSupply -= amount;
    balanceOf[dst] -= amount;
    emit Transfer(dst, address(0), amount);
  }

  function _transferTokens(
    address src,
    address dst,
    uint256 amount
  ) internal {
    balanceOf[src] -= amount;
    balanceOf[dst] += amount;

    emit Transfer(src, dst, amount);
  }

  function _safeTransferFrom(
    address token,
    address from,
    address to,
    uint256 value
  ) internal {
    // solhint-disable-next-line avoid-low-level-calls
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
    if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert UnsuccessfulTransfer();
  }
}
