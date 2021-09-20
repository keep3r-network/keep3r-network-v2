import { smock } from '@defi-wonderland/smock';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IERC20,
  ISwapRouter,
  IUniswapV3Pool,
  LiquidityAmountsTest,
  LiquidityAmountsTest__factory,
  UniV3PairManager,
  UniV3PairManager__factory,
} from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import chai, { expect } from 'chai';
import { JsonRpcSigner } from 'ethers/node_modules/@ethersproject/providers';
import { ethers } from 'hardhat';
import * as common from './common';

chai.use(smock.matchers);

const DAI_WETH_POOL = '0x60594a405d53811d3BC4766596EFD80fd545A270';
const DAI_WETH_WHALE = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';
const UNIV3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

describe('UniV3PairManager', () => {
  //factories
  let uniV3PairManagerFactory: UniV3PairManager__factory;

  //contracts
  let uniV3PairManager: UniV3PairManager;
  let uniswapPool: IUniswapV3Pool;
  let liquidityAmounts: LiquidityAmountsTest;
  let liquidityAmountsFactory: LiquidityAmountsTest__factory;
  let uniRouter: ISwapRouter;

  //tokens
  let dai: IERC20;
  let weth: IERC20;

  //signers
  let governance: SignerWithAddress;
  let deployer: SignerWithAddress;
  let whale: JsonRpcSigner;

  //misc
  let liquidity: BigNumber;
  let tenTokens: BigNumber = toUnit(10);
  let twentyTokens: BigNumber = toUnit(20);
  let amount0MinIsZero: number = 0;
  let amount1MinIsZero: number = 0;

  before(async () => {
    [deployer, governance] = await ethers.getSigners();

    dai = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.DAI_ADDRESS)) as IERC20;
    weth = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.WETH_ADDRESS)) as IERC20;
    uniswapPool = (await ethers.getContractAt('IUniswapV3Pool', DAI_WETH_POOL)) as IUniswapV3Pool;
    uniRouter = (await ethers.getContractAt('ISwapRouter', UNIV3_ROUTER_ADDRESS)) as ISwapRouter;

    uniV3PairManagerFactory = (await ethers.getContractFactory('UniV3PairManager')) as UniV3PairManager__factory;
    liquidityAmountsFactory = (await ethers.getContractFactory('LiquidityAmountsTest')) as LiquidityAmountsTest__factory;
  });

  beforeEach(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    uniV3PairManager = await uniV3PairManagerFactory.deploy(DAI_WETH_POOL, deployer.address);
    liquidityAmounts = await liquidityAmountsFactory.deploy();

    whale = await wallet.impersonate(DAI_WETH_WHALE);

    //mint approvals
    await dai.connect(whale).approve(uniV3PairManager.address, twentyTokens);
    await weth.connect(whale).approve(uniV3PairManager.address, twentyTokens);

    //swap approvals
    await dai.connect(whale).approve(uniRouter.address, tenTokens);
    await weth.connect(whale).approve(uniRouter.address, tenTokens);

    //set governance to governance
    await uniV3PairManager.setGovernance(governance.address);
    await uniV3PairManager.connect(governance).acceptGovernance();
  });

  async function calculateLiquidity(token0: BigNumber, token1: BigNumber): Promise<BigNumber> {
    const sqrtPriceX96 = (await uniswapPool.slot0()).sqrtPriceX96;
    const sqrtRatioAX96 = await uniV3PairManager.sqrtRatioAX96();
    const sqrtRatioBX96 = await uniV3PairManager.sqrtRatioBX96();
    const liquidity = await liquidityAmounts.getLiquidityForAmounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, token0, token1);
    return liquidity;
  }

  describe('mint', async () => {
    it('should increase the DAI/WETH position of the contract if the user provides liquidity', async () => {
      liquidity = await calculateLiquidity(tenTokens, tenTokens);

      await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
      expect((await uniV3PairManager.position()).liquidity).to.eq(liquidity);
    });

    it('should mint credit to the user', async () => {
      liquidity = await calculateLiquidity(tenTokens, tenTokens);

      await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
      expect(await uniV3PairManager.balanceOf(whale._address)).to.eq(liquidity);
    });
  });

  //helper function to reduce shared setup by collect() and burn()
  async function provideLiquidityAndSwap() {
    await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);

    //simulates swap in uniswap pool
    await uniRouter.connect(whale).exactInputSingle({
      tokenIn: await uniV3PairManager.token0(),
      tokenOut: await uniV3PairManager.token1(),
      fee: await uniV3PairManager.fee(),
      recipient: whale._address,
      deadline: 1000000000000,
      amountIn: tenTokens,
      amountOutMinimum: toUnit(0.00001),
      sqrtPriceLimitX96: 0,
    });

    await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
  }

  describe('collect', async () => {
    context('when the contract has liquidity and accrued fees', async () => {
      beforeEach(async () => {
        await provideLiquidityAndSwap();
      });

      it('should send the collected fees to governance', async () => {
        const tokensOwed0 = (await uniV3PairManager.position()).tokensOwed0;
        const tokensOwed1 = (await uniV3PairManager.position()).tokensOwed1;
        await uniV3PairManager.connect(governance).collect();
        expect(await dai.balanceOf(governance.address)).to.equal(tokensOwed0);
        expect(await weth.balanceOf(governance.address)).to.equal(tokensOwed1);
      });
    });
  });

  describe('burn', async () => {
    context('when the contract has liquidity and accrued fees', async () => {
      beforeEach(async () => {
        await provideLiquidityAndSwap();

        liquidity = (await uniV3PairManager.position()).liquidity;
      });
      it('should burn the provided liquidity', async () => {
        await uniV3PairManager.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, whale._address);
        expect((await uniV3PairManager.position()).liquidity).to.equal(0);
      });

      it('should send the gathered fees to recipient', async () => {
        //check the initial balance is 0
        expect(await dai.balanceOf(governance.address)).to.equal(0);
        expect(await weth.balanceOf(governance.address)).to.equal(0);

        //expect the balance to grow after liquidity is burned and tokens are sent to him
        await uniV3PairManager.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, governance.address);

        expect(await dai.balanceOf(governance.address)).to.be.gt(0);
        expect(await weth.balanceOf(governance.address)).to.be.gt(0);
      });

      it('should burn credits from the user who burns liquidity', async () => {
        //check the caller has credits
        expect(await uniV3PairManager.balanceOf(whale._address)).to.equal(liquidity);

        //check credits they're burned after calling burn
        await uniV3PairManager.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, whale._address);
        expect(await uniV3PairManager.balanceOf(whale._address)).to.equal(0);
      });
    });
  });
});
