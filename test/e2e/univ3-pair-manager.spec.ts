import { smock } from '@defi-wonderland/smock';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IERC20,
  ISwapRouter,
  IUniswapV3Pool,
  LiquidityAmountsForTest,
  LiquidityAmountsForTest__factory,
  UniV3PairManager,
  UniV3PairManagerFactory,
  UniV3PairManagerFactory__factory,
} from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import chai, { expect } from 'chai';
import { JsonRpcSigner } from 'ethers/node_modules/@ethersproject/providers';
import { ethers } from 'hardhat';
import * as common from './common';

chai.use(smock.matchers);

const UNIV3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

// pools with different fees => name convention = TOKEN0_TOKEN1_FEE
const KP3R_WETH_1 = common.KP3R_WETH_V3_POOL_ADDRESS;
const WBTC_WETH_0_3 = '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD';
const DAI_WETH_0_0_5 = '0x60594a405d53811d3BC4766596EFD80fd545A270';
const DAI_USDC_0_0_1 = '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168';

// whales
const WHALE = '0x28c6c06298d514db089934071355e5743bf21d60';

describe('UniV3PairManager', () => {
  //factories
  let uniV3PairManagerFactory: UniV3PairManagerFactory__factory;

  //contracts
  let daiWethPool: IUniswapV3Pool;
  let kp3rWethPoolOne: IUniswapV3Pool;
  let kp3rWethPoolTwo: IUniswapV3Pool;
  let daiUsdcPool: IUniswapV3Pool;
  let liquidityAmounts: LiquidityAmountsForTest;
  let liquidityAmountsFactory: LiquidityAmountsForTest__factory;
  let uniRouter: ISwapRouter;
  let uniPairFactory: UniV3PairManagerFactory;

  //tokens
  let dai: IERC20;
  let weth: IERC20;
  let kp3r: IERC20;
  let usdc: IERC20;
  let wbtc: IERC20;

  //signers
  let governance: SignerWithAddress;
  let whale: JsonRpcSigner;

  //misc
  let liquidity: BigNumber;
  let tenTokens: BigNumber = toUnit(10);
  let twentyTokens: BigNumber = toUnit(20);
  let twentyUSDC: BigNumber = toUnit(20).div(10 ** 12);
  let tenUSDC: BigNumber = toUnit(10).div(10 ** 12);
  let amount0MinIsZero: number = 0;
  let amount1MinIsZero: number = 0;
  let snapshotId: string;
  let pair: UniV3PairManager;
  let pool: IUniswapV3Pool;

  // pair managers
  let firstPair: UniV3PairManager;
  let secondPair: UniV3PairManager;
  let thirdPair: UniV3PairManager;
  let fourthPair: UniV3PairManager;

  let firstPairAddress: string;
  let secondPairAddress: string;
  let thirdPairAddress: string;
  let fourthPairAddress: string;

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    [, governance] = await ethers.getSigners();

    dai = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.DAI_ADDRESS)) as IERC20;
    weth = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.WETH_ADDRESS)) as IERC20;
    kp3r = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.KP3R_V1_ADDRESS)) as IERC20;
    usdc = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.USDC_ADDRESS)) as IERC20;
    wbtc = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.WBTC_ADDRESS)) as IERC20;

    uniRouter = (await ethers.getContractAt('ISwapRouter', UNIV3_ROUTER_ADDRESS)) as ISwapRouter;

    kp3rWethPoolOne = (await ethers.getContractAt('IUniswapV3Pool', KP3R_WETH_1)) as IUniswapV3Pool;
    kp3rWethPoolTwo = (await ethers.getContractAt('IUniswapV3Pool', WBTC_WETH_0_3)) as IUniswapV3Pool;
    daiWethPool = (await ethers.getContractAt('IUniswapV3Pool', DAI_WETH_0_0_5)) as IUniswapV3Pool;
    daiUsdcPool = (await ethers.getContractAt('IUniswapV3Pool', DAI_USDC_0_0_1)) as IUniswapV3Pool;

    uniV3PairManagerFactory = (await ethers.getContractFactory('UniV3PairManagerFactory')) as UniV3PairManagerFactory__factory;
    liquidityAmountsFactory = (await ethers.getContractFactory('LiquidityAmountsForTest')) as LiquidityAmountsForTest__factory;

    uniPairFactory = await uniV3PairManagerFactory.deploy(governance.address);

    // deploying different pairs
    await uniPairFactory.createPairManager(KP3R_WETH_1);
    await uniPairFactory.createPairManager(WBTC_WETH_0_3);
    await uniPairFactory.createPairManager(DAI_WETH_0_0_5);
    await uniPairFactory.createPairManager(DAI_USDC_0_0_1);

    // getting the different created pairs
    firstPairAddress = await uniPairFactory.callStatic.pairManagers(KP3R_WETH_1);
    secondPairAddress = await uniPairFactory.callStatic.pairManagers(WBTC_WETH_0_3);
    thirdPairAddress = await uniPairFactory.callStatic.pairManagers(DAI_WETH_0_0_5);
    fourthPairAddress = await uniPairFactory.callStatic.pairManagers(DAI_USDC_0_0_1);

    firstPair = (await ethers.getContractAt('IUniV3PairManager', firstPairAddress)) as UniV3PairManager; // 1% fee
    secondPair = (await ethers.getContractAt('IUniV3PairManager', secondPairAddress)) as UniV3PairManager; // 0.3% fee
    thirdPair = (await ethers.getContractAt('IUniV3PairManager', thirdPairAddress)) as UniV3PairManager; // 0.05% fee
    fourthPair = (await ethers.getContractAt('IUniV3PairManager', fourthPairAddress)) as UniV3PairManager; // 0.01% fee

    liquidityAmounts = await liquidityAmountsFactory.deploy();

    whale = await wallet.impersonate(WHALE);

    //mint approvals
    await kp3r.connect(whale).approve(firstPair.address, twentyTokens);
    await weth.connect(whale).approve(firstPair.address, twentyTokens);

    await wbtc.connect(whale).approve(secondPair.address, twentyTokens);
    await weth.connect(whale).approve(secondPair.address, twentyTokens);

    await dai.connect(whale).approve(thirdPair.address, twentyTokens);
    await weth.connect(whale).approve(thirdPair.address, twentyTokens);

    await dai.connect(whale).approve(fourthPair.address, twentyTokens);
    await usdc.connect(whale).approve(fourthPair.address, twentyUSDC);

    //swap approvals
    await dai.connect(whale).approve(uniRouter.address, tenTokens);
    await weth.connect(whale).approve(uniRouter.address, tenTokens);
    await kp3r.connect(whale).approve(uniRouter.address, tenTokens);
    await usdc.connect(whale).approve(uniRouter.address, tenUSDC);

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  async function calculateLiquidity(token0: BigNumber, token1: BigNumber, pool: IUniswapV3Pool, pair: UniV3PairManager): Promise<BigNumber> {
    const sqrtPriceX96 = (await pool.slot0()).sqrtPriceX96;
    const sqrtRatioAX96 = await pair.sqrtRatioAX96();
    const sqrtRatioBX96 = await pair.sqrtRatioBX96();
    const liquidity = await liquidityAmounts.getLiquidityForAmounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, token0, token1);
    return liquidity;
  }

  async function calculateLiquidityAndMint(
    token0: BigNumber,
    token1: BigNumber,
    pool: IUniswapV3Pool,
    pair: UniV3PairManager
  ): Promise<BigNumber> {
    let liquidity;

    if ((await pair.token0()) && (await pair.token1()) !== usdc.address) {
      liquidity = await calculateLiquidity(token0, token1, pool, pair);
      await pair.connect(whale).mint(token0, token1, amount0MinIsZero, amount1MinIsZero, whale._address);
    } else if ((await pair.token0()) == usdc.address) {
      liquidity = await calculateLiquidity(token0.div(10 ** 12), token1, pool, pair);
      await pair.connect(whale).mint(token0.div(10 ** 12), token1, amount0MinIsZero, amount1MinIsZero, whale._address);
    } else {
      liquidity = await calculateLiquidity(token0, token1.div(10 ** 12), pool, pair);
      await pair.connect(whale).mint(token0, token1.div(10 ** 12), amount0MinIsZero, amount1MinIsZero, whale._address);
    }
    return liquidity;
  }

  describe('mint', () => {
    [
      { getPair: () => firstPair, getPool: () => kp3rWethPoolOne, fee: '1%' },
      { getPair: () => secondPair, getPool: () => kp3rWethPoolTwo, fee: '0.3%' },
      { getPair: () => thirdPair, getPool: () => daiWethPool, fee: '0.05%' },
      { getPair: () => fourthPair, getPool: () => daiUsdcPool, fee: '0.01%' },
    ].forEach(({ getPair, getPool, fee }) => {
      it(`should increase the position of the contract if the user provides liquidity in a pair with ${fee} fee`, async () => {
        pair = getPair();
        pool = getPool();
        liquidity = await calculateLiquidityAndMint(tenTokens, tenTokens, pool, pair);
        expect((await pair.position()).liquidity).to.eq(liquidity);
      });

      it(`should mint credit to the user if the user deposited liquidity in a ${fee} pair`, async () => {
        pair = getPair();
        pool = getPool();
        liquidity = await calculateLiquidityAndMint(tenTokens, tenTokens, pool, pair);
        expect(await pair.balanceOf(whale._address)).to.eq(liquidity);
      });
    });
  });

  //helper function to reduce shared setup by collect() and burn()
  async function provideLiquidityAndSwap() {
    await firstPair.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);

    //simulates swap in uniswap pool
    await uniRouter.connect(whale).exactInputSingle({
      tokenIn: await firstPair.token0(),
      tokenOut: await firstPair.token1(),
      fee: await firstPair.fee(),
      recipient: whale._address,
      deadline: 1000000000000,
      amountIn: tenTokens,
      amountOutMinimum: toUnit(0.00001),
      sqrtPriceLimitX96: 0,
    });

    await firstPair.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
  }

  describe('collect', () => {
    context('when the contract has liquidity and accrued fees', () => {
      beforeEach(async () => {
        await provideLiquidityAndSwap();
      });

      it('should send the collected fees to governance', async () => {
        const tokensOwed0 = (await firstPair.position()).tokensOwed0;
        const tokensOwed1 = (await firstPair.position()).tokensOwed1;
        await firstPair.connect(governance).collect();
        expect(await kp3r.balanceOf(governance.address)).to.equal(tokensOwed0);
        expect(await weth.balanceOf(governance.address)).to.equal(tokensOwed1);
      });
    });
  });

  describe('burn', () => {
    context('when the contract has liquidity and accrued fees', () => {
      beforeEach(async () => {
        await provideLiquidityAndSwap();

        liquidity = (await firstPair.position()).liquidity;
      });
      it('should burn the provided liquidity', async () => {
        await firstPair.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, whale._address);
        expect((await firstPair.position()).liquidity).to.equal(0);
      });

      it('should send the gathered fees to recipient', async () => {
        //check the initial balance is 0
        expect(await kp3r.balanceOf(governance.address)).to.equal(0);
        expect(await weth.balanceOf(governance.address)).to.equal(0);

        //expect the balance to grow after liquidity is burned and tokens are sent to him
        await firstPair.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, governance.address);

        expect(await kp3r.balanceOf(governance.address)).to.be.gt(0);
        expect(await weth.balanceOf(governance.address)).to.be.gt(0);
      });

      it('should burn credits from the user who burns liquidity', async () => {
        //check the caller has credits
        expect(await firstPair.balanceOf(whale._address)).to.equal(liquidity);

        //check credits they're burned after calling burn
        await firstPair.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, whale._address);
        expect(await firstPair.balanceOf(whale._address)).to.equal(0);
      });
    });
  });
});
