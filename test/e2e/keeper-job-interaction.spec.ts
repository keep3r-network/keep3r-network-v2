import { JsonRpcSigner } from '@ethersproject/providers';
import { IKeep3rV1, IUniswapV3Pool, JobForTest, Keep3r, Keep3rHelperForTest, UniV3PairManager } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
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
  let keeper: JsonRpcSigner;
  let snapshotId: string;
  let pair: UniV3PairManager;
  let pool: IUniswapV3Pool;

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    jobOwner = await wallet.impersonate(common.RICH_KP3R_ADDRESS);
    keeper = await wallet.impersonate(common.RICH_ETH_ADDRESS);

    ({ keep3r, governance, keep3rV1, helper } = await common.setupKeep3r());

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

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
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

  it('should pay the keeper for the accounted gas', async () => {
    // add liquidity to pair
    const { liquidity } = await common.addLiquidityToPair(jobOwner, pair, toUnit(100), jobOwner);
    // add credit to job
    await pair.connect(jobOwner).approve(keep3r.address, liquidity);
    await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);
    // wait some time to mint credits
    await evm.advanceTimeAndBlock(moment.duration(5, 'days').as('seconds'));
    const keeperBondsBeforeWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);

    let initialGas: BigNumber;
    let finalGas: BigNumber;

    // work as keeper
    const tx = await job.connect(keeper).work();

    // event logs
    let filter = {
      address: keep3r.address,
      fromBlock: tx.blockNumber,
      toBlock: tx.blockNumber,
      topics: [ethers.utils.id('KeeperValidation(uint256)')],
    };

    const logsValidation = await ethers.provider.getLogs(filter);
    initialGas = BigNumber.from(logsValidation[0].data);

    filter.topics = [ethers.utils.id('KeeperWork(address,address,address,uint256,uint256)')];
    const logsWork = await ethers.provider.getLogs(filter);
    finalGas = BigNumber.from('0x' + logsWork[0].data.substring(66, 130));

    // gas calculation
    const gasUsed = initialGas.sub(finalGas);
    const quote = await helper.getRewardAmount(gasUsed);
    const keeperBondsAfterWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);
    const bondsEarned: BigNumber = keeperBondsAfterWork.sub(keeperBondsBeforeWork);

    // twap calculation
    const BASE = 10_000;
    const observation = await keep3r.observeLiquidity(common.KP3R_WETH_V3_POOL_ADDRESS);
    const period = await keep3r.rewardPeriodTime();
    const twapQuote = 1.0001 ** observation.difference.div(period).toNumber();
    const baseFee = await helper.basefee();
    const expectedReward = gasUsed
      .mul(baseFee)
      .mul(BASE)
      .div(Math.floor(twapQuote * BASE));

    // uniswap calculation
    const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const secondsAgo0 = timestamp % period.toNumber();
    const secondsAgo1 = secondsAgo0 + period.toNumber();
    const uniswapObservation = await pool.observe([secondsAgo0, secondsAgo1]);

    const tick0 = uniswapObservation.tickCumulatives[0];
    const tick1 = uniswapObservation.tickCumulatives[1];
    const uniswapQuote = 1.0001 ** tick0.sub(tick1).div(period).toNumber();
    const calculatedReward = gasUsed
      .mul(baseFee)
      .mul(BASE)
      .div(Math.floor(uniswapQuote * BASE));

    expect(bondsEarned).to.be.eq(quote);
    expect(bondsEarned).to.be.closeTo(expectedReward.mul(11).div(10), toUnit(0.001).toNumber());
    expect(bondsEarned).to.be.closeTo(calculatedReward.mul(11).div(10), toUnit(0.001).toNumber());
  });
});
