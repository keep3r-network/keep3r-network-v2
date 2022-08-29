import { JsonRpcSigner } from '@ethersproject/providers';
import { IAggregatorV3, IKeep3rV1, IKeep3rV1Proxy, IUniswapV3Pool, JobForTest, Keep3r, Keep3rHelperForTest, UniV3PairManager } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import * as common from './common';

describe('@skip-on-coverage Keeper Job Interaction', () => {
  let jobOwner: JsonRpcSigner;
  let keep3r: Keep3r;
  let keep3rV1: IKeep3rV1;
  let helper: Keep3rHelperForTest;
  let job: JobForTest;
  let governance: JsonRpcSigner;
  let keep3rV1Proxy: IKeep3rV1Proxy;
  let keep3rV1ProxyGovernance: JsonRpcSigner;
  let keeper: JsonRpcSigner;
  let pair: UniV3PairManager;
  let pool: IUniswapV3Pool;

  beforeEach(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    jobOwner = await wallet.impersonate(common.RICH_KP3R_ADDRESS);
    keeper = await wallet.impersonate(common.RICH_ETH_ADDRESS);

    ({ keep3r, governance, keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance, helper } = await common.setupKeep3r());

    // create job
    job = await common.createJobForTest(keep3r.address, jobOwner);
    await keep3r.connect(governance).addJob(job.address);

    // create keeper
    await keep3r.connect(keeper).bond(keep3rV1.address, 0);
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(keep3rV1.address);

    pair = await common.createLiquidityPair(governance);
    await keep3r.connect(governance).approveLiquidity(pair.address);

    pool = (await ethers.getContractAt('IUniswapV3Pool', common.KP3R_WETH_V3_POOL_ADDRESS)) as IUniswapV3Pool;
  });

  it('should not be able to work if there are no funds in job', async () => {
    await expect(job.connect(keeper).work()).to.be.revertedWith('InsufficientFunds()');
  });

  it('should pay the keeper with bonds from job credits', async () => {
    // add liquidity to pair
    const { liquidity } = await common.addLiquidityToPair(jobOwner, pair, toUnit(10), jobOwner);
    // add credit to job
    await pair.connect(jobOwner).approve(keep3r.address, liquidity);
    await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);
    // wait some time to mint credits
    await evm.advanceTimeAndBlock(moment.duration(5, 'days').as('seconds'));

    const keeperBondsBeforeWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);
    const jobLiquidityCreditsBeforeWork: BigNumber = await keep3r.jobLiquidityCredits(job.address);

    // work as keeper
    await job.connect(keeper).work();

    const jobLiquidityCreditsAfterWork: BigNumber = await keep3r.jobLiquidityCredits(job.address);
    const keeperBondsAfterWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);
    const liquidityCreditsSpent: BigNumber = jobLiquidityCreditsBeforeWork.sub(jobLiquidityCreditsAfterWork);
    const bondsEarned: BigNumber = keeperBondsAfterWork.sub(keeperBondsBeforeWork);

    expect(liquidityCreditsSpent).to.be.gt(0);
    expect(bondsEarned).to.be.gt(0);
    expect(liquidityCreditsSpent).to.be.eq(bondsEarned);
  });

  [
    { fnName: 'work', workFn: async () => await job.connect(keeper).work() },
    { fnName: 'workHard', workFn: async () => await job.connect(keeper).workHard(10) },
  ].forEach(({ fnName, workFn }) => {
    context(fnName, () => {
      it('should pay the keeper with a minimum gas fee if baseFee is too low', async () => {
        await helper.setBaseFee(0);

        const minBoost = await helper.minBoost();
        const baseFee = await helper.minBaseFee();

        await testKeeperPayment(minBoost, workFn, baseFee);
      });

      it('should pay the keeper for the accounted gas plus extra with min boost', async () => {
        const minBoost = await helper.minBoost();
        const baseFee = await helper.basefee();
        const minPriorityFee = await helper.minPriorityFee();

        await testKeeperPayment(minBoost, workFn, baseFee.add(minPriorityFee));
      });

      it('should pay the keeper for the accounted gas plus extra with max boost', async () => {
        // mint, bond and activate a ton of KP3R
        const toBond = toUnit(500);
        await keep3rV1Proxy.connect(keep3rV1ProxyGovernance)['mint(address,uint256)'](keeper._address, toBond);
        await keep3rV1.connect(keeper).approve(keep3r.address, toBond);
        await keep3r.connect(keeper).bond(keep3rV1.address, toBond);
        await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
        await keep3r.connect(keeper).activate(keep3rV1.address);

        const maxBoost = await helper.maxBoost();
        const baseFee = await helper.basefee();
        const minPriorityFee = await helper.minPriorityFee();

        await testKeeperPayment(maxBoost, workFn, baseFee.add(minPriorityFee));
      });
    });
  });

  async function testKeeperPayment(expectedBoost: BigNumber, workFn: () => Promise<ContractTransaction>, baseFee: BigNumber) {
    // add liquidity to pair
    const { liquidity } = await common.addLiquidityToPair(jobOwner, pair, toUnit(100), jobOwner);
    // add credit to job
    await pair.connect(jobOwner).approve(keep3r.address, liquidity);
    await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);
    // wait some time to mint credits
    await evm.advanceTimeAndBlock(moment.duration(5, 'days').as('seconds'));

    await job.connect(keeper).work(); // avoid first work tx outlier

    let initialGas: BigNumber;
    let finalGas: BigNumber;

    // work as keeper
    const blockNumberBeforeWork = await ethers.provider.getBlockNumber();
    const keeperBondsBeforeWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);
    const workTx = await workFn();
    const keeperBondsAfterWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);

    // events
    const validationEvent = (await keep3r.queryFilter(keep3r.filters.KeeperValidation(), workTx.blockNumber, workTx.blockNumber))[0];
    const workEvent = (await keep3r.queryFilter(keep3r.filters.KeeperWork(), workTx.blockNumber, workTx.blockNumber))[0];

    initialGas = BigNumber.from(validationEvent.args._gasLeft);
    finalGas = BigNumber.from(workEvent.args._gasLeft);

    // gas calculation
    const accountedGas = initialGas.sub(finalGas);
    const extraGas = await helper.workExtraGas();
    const gasRewarded = accountedGas.add(extraGas);

    const quote = await helper.connect(keeper).getRewardAmount(gasRewarded, { blockTag: blockNumberBeforeWork });
    const bondsEarned: BigNumber = keeperBondsAfterWork.sub(keeperBondsBeforeWork);

    // twap calculation
    const BASE = 1_000_000;
    const boostBase = await helper.BOOST_BASE();
    const ethToQuote = gasRewarded.mul(baseFee).mul(expectedBoost).div(boostBase);
    const expectedReward = await helper.quote(ethToQuote);

    // uniswap calculation
    const period = await helper.quoteTwapTime();
    const { tickCumulatives } = await pool.observe([period, 0]);
    const tick0 = tickCumulatives[0];
    const tick1 = tickCumulatives[1];
    const uniswapQuote = 1.0001 ** tick1.sub(tick0).div(period).toNumber();
    const calculatedReward = ethToQuote.mul(BASE).div(Math.floor(uniswapQuote * BASE));

    // chainlink price feed calculation
    const aggregatorV3 = (await ethers.getContractAt('IAggregatorV3', common.CHAINLINK_KP3R_ETH_PRICE_FEED)) as IAggregatorV3;
    const { answer: priceFeedAnswer } = await aggregatorV3.latestRoundData();
    const chainlinkQuotedReward = ethToQuote.mul(toUnit(1)).div(priceFeedAnswer);

    expect((await workTx.wait()).gasUsed).to.be.closeTo(gasRewarded, 3_000);
    expect(bondsEarned).to.be.closeTo(quote, 1);
    expect(bondsEarned).to.be.closeTo(expectedReward, toUnit(0.001).toNumber());
    expect(bondsEarned).to.be.closeTo(calculatedReward, toUnit(0.001).toNumber());
    expect(bondsEarned).to.be.closeTo(chainlinkQuotedReward, toUnit(0.1) as any);
  }
});
