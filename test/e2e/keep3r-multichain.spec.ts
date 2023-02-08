import { JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  BridgeForTest,
  BridgeForTest__factory,
  IKeep3rV1,
  IUniswapV3Pool,
  IUniV3PairManager,
  IWeth9,
  JobRatedForTest,
  JobRatedForTest__factory,
  Keep3rEscrow,
  Keep3rEscrow__factory,
  Keep3rHelperSidechain,
  Keep3rHelperSidechain__factory,
  Keep3rSidechain,
  Keep3rSidechain__factory,
} from '@types';
import { bn, contracts, evm, wallet } from '@utils';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { KP3R_V1_ADDRESS, KP3R_WETH_V3_POOL_ADDRESS, PAIR_MANAGER_ADDRESS, WETH_ADDRESS, WETH_DAI_V3_POOL_ADDRESS } from './common';

const kp3rWhaleAddress = '0xa0f75491720835b36edc92d06ddc468d201e9b73';

chai.use(solidity);

const DAY = 86400;
const ONE = bn.toUnit(1);
const BONDS = bn.toUnit(10);
const ESCROW_AMOUNT = bn.toUnit(100);
const DELTA = bn.toUnit(0.001).toNumber();

describe('Keep3r Sidechain @skip-on-coverage', () => {
  let deployer: SignerWithAddress;
  let stranger: SignerWithAddress;
  let keeper: SignerWithAddress;
  let governor: SignerWithAddress;
  let kp3rWhale: JsonRpcSigner;
  let keep3r: Keep3rSidechain;
  let keep3rHelper: Keep3rHelperSidechain;
  let keep3rEscrow: Keep3rEscrow;
  let kp3rV1: IKeep3rV1;
  let wKP3R: BridgeForTest;
  let wKLP: BridgeForTest;
  let weth: IWeth9;
  let pairManager: IUniV3PairManager;
  let job: JobRatedForTest;
  let snapshotId: string;
  let kp3rWethPool: IUniswapV3Pool;
  let wethDaiPool: IUniswapV3Pool;

  const oneDay = 86400;

  // approximate quotes in block 15100000
  const oneKP3RinETH = bn.toUnit(114).div(1000); // 1KP3R ~ 0.114 ETH
  const oneETHinDAI = bn.toUnit(1254); // 1ETH ~ $1250 DAI

  before(async () => {
    [deployer, stranger, keeper, governor] = await ethers.getSigners();
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: 15100000,
    });

    kp3rV1 = (await ethers.getContractAt('IKeep3rV1', KP3R_V1_ADDRESS)) as IKeep3rV1;
    pairManager = (await ethers.getContractAt('IUniV3PairManager', PAIR_MANAGER_ADDRESS)) as IUniV3PairManager;
    weth = (await ethers.getContractAt('IWeth9', WETH_ADDRESS)) as IWeth9;

    kp3rWethPool = (await ethers.getContractAt('IUniswapV3Pool', KP3R_WETH_V3_POOL_ADDRESS)) as IUniswapV3Pool;
    wethDaiPool = (await ethers.getContractAt('IUniswapV3Pool', WETH_DAI_V3_POOL_ADDRESS)) as IUniswapV3Pool;
    await evm.advanceTimeAndBlock(oneDay * 10); // stalls pool twap quotes

    kp3rWhale = await wallet.impersonate(kp3rWhaleAddress);

    const wKP3RFactory = (await ethers.getContractFactory('BridgeForTest')) as BridgeForTest__factory;
    wKP3R = await wKP3RFactory.deploy(kp3rV1.address);

    const wKLPp3rFactory = (await ethers.getContractFactory('BridgeForTest')) as BridgeForTest__factory;
    wKLP = await wKLPp3rFactory.deploy(pairManager.address);

    const keep3rEscrowFactory = (await ethers.getContractFactory('Keep3rEscrow')) as Keep3rEscrow__factory;
    keep3rEscrow = await keep3rEscrowFactory.deploy(governor.address, wKP3R.address);

    const currentNonce: number = await ethers.provider.getTransactionCount(deployer.address);
    const precalculatedAddress = ethers.utils.getContractAddress({ from: deployer.address, nonce: currentNonce + 1 });

    const keep3rHelperFactory = (await ethers.getContractFactory('Keep3rHelperSidechain')) as Keep3rHelperSidechain__factory;
    keep3rHelper = await keep3rHelperFactory.deploy(
      precalculatedAddress,
      governor.address,
      KP3R_V1_ADDRESS,
      WETH_ADDRESS,
      KP3R_WETH_V3_POOL_ADDRESS, // uses KP3R-WETH pool as oracle
      WETH_DAI_V3_POOL_ADDRESS // uses WETH-DAI pool as oracle
    );

    const kp3rSidechainFactory = (await ethers.getContractFactory('Keep3rSidechain')) as Keep3rSidechain__factory;
    keep3r = await kp3rSidechainFactory.deploy(
      governor.address,
      keep3rHelper.address,
      wKP3R.address,
      keep3rEscrow.address // replaces keep3rV1Proxy
    );

    // setup
    await keep3rHelper.connect(governor).setOracle(wKLP.address, await pairManager.pool());
    await keep3r.connect(governor).approveLiquidity(wKLP.address);

    // mint kLPs
    await contracts.setBalance(kp3rWhale._address, bn.toUnit(1000));
    await weth.connect(kp3rWhale).deposit({ value: bn.toUnit(100) });
    await weth.connect(kp3rWhale).approve(pairManager.address, bn.toUnit(100));
    await kp3rV1.connect(kp3rWhale).approve(pairManager.address, bn.toUnit(100));

    await pairManager.connect(kp3rWhale).mint(bn.toUnit(100), bn.toUnit(100), 1, 0, kp3rWhaleAddress);

    // bridge tokens
    await kp3rV1.connect(kp3rWhale).approve(wKP3R.address, ESCROW_AMOUNT);
    await wKP3R.connect(kp3rWhale).bridge(ESCROW_AMOUNT);

    await pairManager.connect(kp3rWhale).approve(wKLP.address, BONDS);
    await wKLP.connect(kp3rWhale).bridge(BONDS);

    // fund escrow
    await wKP3R.connect(kp3rWhale).approve(keep3rEscrow.address, ESCROW_AMOUNT);
    await keep3rEscrow.connect(kp3rWhale).deposit(ESCROW_AMOUNT);
    await keep3rEscrow.connect(governor).setMinter(keep3r.address);

    // deploy job
    const jobFactory = (await ethers.getContractFactory('JobRatedForTest')) as JobRatedForTest__factory;
    job = await jobFactory.deploy(keep3r.address);
    await keep3r.connect(stranger).addJob(job.address);

    // activate a keeper
    await keep3r.connect(keeper).bond(wKP3R.address, 0);
    await evm.advanceTimeAndBlock(3 * DAY);
    await keep3r.connect(keeper).activate(wKP3R.address);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('escrow', () => {
    const BONDS = bn.toUnit(10);
    let previousEscrowBalance: BigNumber;

    beforeEach(async () => {
      previousEscrowBalance = await wKP3R.balanceOf(keep3rEscrow.address);

      // "bridge" wKP3R
      await kp3rV1.connect(kp3rWhale).approve(wKP3R.address, BONDS);
      await wKP3R.connect(kp3rWhale).bridge(BONDS);

      // bond to Keep3r
      await wKP3R.connect(kp3rWhale).approve(keep3r.address, BONDS);
      await keep3r.connect(kp3rWhale).bond(wKP3R.address, BONDS);

      // activate
      await evm.advanceTimeAndBlock(3 * DAY);
      await keep3r.connect(kp3rWhale).activate(wKP3R.address);
    });

    it('should not increase the virtualReserves when bonding', async () => {
      expect(await keep3r.totalBonds()).to.eq(BONDS);
      expect(await keep3r.virtualReserves()).to.eq(ESCROW_AMOUNT);
    });

    it('should deposit tokens on escrow contract when bonding', async () => {
      expect(await wKP3R.balanceOf(keep3rEscrow.address)).to.be.eq(previousEscrowBalance.add(BONDS));
    });

    it('should mint transfer tokens from the escrow contract when unbonding', async () => {
      previousEscrowBalance = await wKP3R.balanceOf(keep3rEscrow.address);

      await keep3r.connect(kp3rWhale).unbond(wKP3R.address, BONDS);
      await evm.advanceTimeAndBlock(14 * DAY);
      await keep3r.connect(kp3rWhale).withdraw(wKP3R.address);

      expect(await wKP3R.balanceOf(keep3rEscrow.address)).to.be.eq(previousEscrowBalance.sub(BONDS));
    });
  });

  describe('keep3r sidechain', () => {
    let kLPBalance: BigNumber;

    beforeEach(async () => {
      kLPBalance = await wKLP.balanceOf(kp3rWhaleAddress);
      await wKLP.connect(kp3rWhale).approve(keep3r.address, kLPBalance);

      await keep3r.connect(kp3rWhale).addLiquidityToJob(job.address, wKLP.address, kLPBalance);
      await evm.advanceTimeAndBlock(DAY);
    });

    it('should generate credits corresponding to twap calculation', async () => {
      const mintedCredits = await keep3r.totalJobCredits(job.address);

      const rewardPeriod = await keep3r.rewardPeriodTime();
      const inflationPeriod = await keep3r.inflationPeriod();
      const kp3rTicks = (await kp3rWethPool.observe([rewardPeriod, 0]))[0];
      const tick = kp3rTicks[1].sub(kp3rTicks[0]);

      const underlyingKP3Rs = await keep3rHelper.getKP3RsAtTick(kLPBalance, tick, rewardPeriod);

      const expectedCredits = underlyingKP3Rs.mul(DAY).div(inflationPeriod);

      expect(mintedCredits).to.be.gt(0);
      expect(mintedCredits).to.closeTo(expectedCredits, DELTA);
    });

    it('should earn bonds for working a job quoted in USD', async () => {
      const twapPeriod = await keep3rHelper.quoteTwapTime();
      const tx = await job.connect(keeper).workHard(30);

      const validationEvent = (await keep3r.queryFilter(keep3r.filters.KeeperValidation(), tx.blockNumber, tx.blockNumber))[0];
      const workEvent = (await keep3r.queryFilter(keep3r.filters.KeeperWork(), tx.blockNumber, tx.blockNumber))[0];
      const initialGas = BigNumber.from(validationEvent.args._gasLeft);
      const finalGas = BigNumber.from(workEvent.args._gasLeft);
      const gasUsed = initialGas.sub(finalGas);

      const usdPerGasUnit = await job.usdPerGasUnit();

      const reward = await keep3r.bonds(keeper.address, wKP3R.address);

      const kp3rTicks = (await kp3rWethPool.observe([twapPeriod, 0]))[0];
      const isKP3RToken0 = (await kp3rWethPool.token0()) == kp3rV1.address;
      let kp3rQuote: BigNumber;
      if (isKP3RToken0) {
        kp3rQuote = await keep3rHelper.getQuoteAtTick(ONE, kp3rTicks[0].sub(kp3rTicks[1]), twapPeriod);
      } else {
        kp3rQuote = await keep3rHelper.getQuoteAtTick(ONE, kp3rTicks[1].sub(kp3rTicks[0]), twapPeriod);
      }

      expect(kp3rQuote).to.be.closeTo(oneKP3RinETH, DELTA);

      const wethTicks = (await wethDaiPool.observe([twapPeriod, 0]))[0];
      const isWETHToken0 = (await wethDaiPool.token0()) == weth.address;
      let wethQuote: BigNumber;
      if (isWETHToken0) {
        wethQuote = await keep3rHelper.getQuoteAtTick(ONE, wethTicks[0].sub(wethTicks[1]), twapPeriod);
      } else {
        wethQuote = await keep3rHelper.getQuoteAtTick(ONE, wethTicks[1].sub(wethTicks[0]), twapPeriod);
      }

      // closeTo doesn't take BigNumbers
      expect(wethQuote).to.be.gt(oneETHinDAI.sub(ONE));
      expect(wethQuote).to.be.lt(oneETHinDAI.add(ONE));

      const expectedUSDReward = usdPerGasUnit.mul(gasUsed);
      const expectedWETHReward = ONE.mul(expectedUSDReward).div(wethQuote);
      const expectedKP3RReward = ONE.mul(expectedWETHReward).div(kp3rQuote);

      expect(reward).to.be.closeTo(expectedKP3RReward.mul(110).div(100), DELTA); // expected +10%
    });

    it('should earn more bonds when having bonded wKP3R', async () => {
      const initialBonds = bn.toUnit(200);
      await kp3rV1.connect(kp3rWhale).approve(wKP3R.address, initialBonds);
      await wKP3R.connect(kp3rWhale).bridge(initialBonds);
      await wKP3R.connect(kp3rWhale).transfer(keeper.address, initialBonds);
      await wKP3R.connect(keeper).approve(keep3r.address, initialBonds);
      await keep3r.connect(keeper).bond(wKP3R.address, initialBonds);
      await evm.advanceTimeAndBlock(3 * DAY);
      await keep3r.connect(keeper).activate(wKP3R.address);

      const twapPeriod = await keep3rHelper.quoteTwapTime();
      const tx = await job.connect(keeper).workHard(30);

      const validationEvent = (await keep3r.queryFilter(keep3r.filters.KeeperValidation(), tx.blockNumber, tx.blockNumber))[0];
      const workEvent = (await keep3r.queryFilter(keep3r.filters.KeeperWork(), tx.blockNumber, tx.blockNumber))[0];
      const initialGas = BigNumber.from(validationEvent.args._gasLeft);
      const finalGas = BigNumber.from(workEvent.args._gasLeft);
      const gasUsed = initialGas.sub(finalGas);

      const usdPerGasUnit = await job.usdPerGasUnit();

      const reward = (await keep3r.bonds(keeper.address, wKP3R.address)).sub(initialBonds);

      const kp3rTicks = (await kp3rWethPool.observe([twapPeriod, 0]))[0];
      const isKP3RToken0 = (await kp3rWethPool.token0()) == kp3rV1.address;
      let kp3rQuote: BigNumber;
      if (isKP3RToken0) {
        kp3rQuote = await keep3rHelper.getQuoteAtTick(ONE, kp3rTicks[0].sub(kp3rTicks[1]), twapPeriod);
      } else {
        kp3rQuote = await keep3rHelper.getQuoteAtTick(ONE, kp3rTicks[1].sub(kp3rTicks[0]), twapPeriod);
      }

      expect(kp3rQuote).to.be.closeTo(oneKP3RinETH, DELTA);

      const wethTicks = (await wethDaiPool.observe([twapPeriod, 0]))[0];
      const isWETHToken0 = (await wethDaiPool.token0()) == weth.address;
      let wethQuote: BigNumber;
      if (isWETHToken0) {
        wethQuote = await keep3rHelper.getQuoteAtTick(ONE, wethTicks[0].sub(wethTicks[1]), twapPeriod);
      } else {
        wethQuote = await keep3rHelper.getQuoteAtTick(ONE, wethTicks[1].sub(wethTicks[0]), twapPeriod);
      }

      // closeTo doesn't take BigNumbers
      expect(wethQuote).to.be.gt(oneETHinDAI.sub(ONE));
      expect(wethQuote).to.be.lt(oneETHinDAI.add(ONE));

      const expectedUSDReward = usdPerGasUnit.mul(gasUsed);
      const expectedWETHReward = ONE.mul(expectedUSDReward).div(wethQuote);
      const expectedKP3RReward = ONE.mul(expectedWETHReward).div(kp3rQuote);

      expect(reward).to.be.closeTo(expectedKP3RReward.mul(120).div(100), DELTA); // expected +20%
    });

    it('should reduce the virtualReserves', async () => {
      const prevVirtualSupply = await keep3r.virtualReserves();
      await job.connect(keeper).work();
      expect(await keep3r.virtualReserves()).to.be.lt(prevVirtualSupply);
    });

    it('should be able to withdraw bonds', async () => {
      await job.connect(keeper).work();

      const bonds = await keep3r.bonds(keeper.address, wKP3R.address);
      expect(await keep3rHelper.bonds(keeper.address)).to.be.eq(bonds);

      await keep3r.connect(keeper).unbond(wKP3R.address, bonds);
      await evm.advanceTimeAndBlock(14 * DAY);
      await keep3r.connect(keeper).withdraw(wKP3R.address);

      expect(await wKP3R.balanceOf(keeper.address)).to.be.eq(bonds);
    });
  });
});
