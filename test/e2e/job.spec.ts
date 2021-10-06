import { JsonRpcSigner } from '@ethersproject/providers';
import { JobForTest, Keep3r, UniV3PairManager } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { BigNumber, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import * as common from './common';

describe('@skip-on-coverage Job', () => {
  let jobOwner: JsonRpcSigner;
  let richGuy: JsonRpcSigner;
  let keeper: Wallet;
  let keep3r: Keep3r;
  let job: JobForTest;
  let pair: UniV3PairManager;
  let governance: JsonRpcSigner;
  let snapshotId: string;

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    jobOwner = await wallet.impersonate(common.RICH_ETH_ADDRESS);
    keeper = await wallet.generateRandomWithEth(toUnit(10));

    ({ keep3r, governance } = await common.setupKeep3r());

    rewardPeriodTime = (await keep3r.rewardPeriodTime()).toNumber();

    job = await common.createJobForTest(keep3r.address, jobOwner);

    pair = await common.createLiquidityPair(governance);

    richGuy = await wallet.impersonate(common.RICH_KP3R_ADDRESS);

    await activateKeeper(keeper);
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  it('should fail to add liquidity to an unnaproved pool', async () => {
    await expect(keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, toUnit(1))).to.be.revertedWith(
      'LiquidityPairUnapproved()'
    );
  });

  it('should not be able to add liquidity to an unexistent job', async () => {
    await keep3r.connect(governance).approveLiquidity(pair.address);
    await expect(keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, toUnit(1))).to.be.revertedWith('JobUnavailable()');
  });

  context('when adding an approved liquidity on an existent job', () => {
    const liquidityAdded = toUnit(100);
    let initialLiquidity: BigNumber;
    let spentKp3rs: BigNumber;

    beforeEach(async () => {
      // make twap stable for calculations
      await evm.advanceTimeAndBlock(moment.duration(30, 'days').as('seconds'));

      // create job and add liquidity to it
      await keep3r.connect(jobOwner).addJob(job.address);
      await keep3r.connect(governance).approveLiquidity(pair.address);

      const response = await common.addLiquidityToPair(richGuy, pair, liquidityAdded, jobOwner);
      initialLiquidity = response.liquidity;
      spentKp3rs = response.spentKp3rs;

      await pair.connect(jobOwner).approve(keep3r.address, initialLiquidity);
      await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, initialLiquidity);
    });

    it('should generate liquidity credits from liquidity added to job', async () => {
      // should not have any credits inmediately after inserting liquidity into a job
      expect(await keep3r.totalJobCredits(job.address)).to.equal(0);

      // wait some time
      await evm.advanceTimeAndBlock(moment.duration(2.5, 'days').as('seconds'));

      // should have minted some credits
      let jobMintedCredits = (await keep3r.jobPeriodCredits(job.address))
        .mul(moment.duration(2.5, 'days').as('seconds') + 1)
        .div(rewardPeriodTime);
      let totalJobCredits = await keep3r.totalJobCredits(job.address);

      // using closeTo because of 1 second difference between views and expectation
      expect(totalJobCredits).to.be.closeTo(jobMintedCredits, toUnit(0.005).toNumber());
    });

    it('should generate the underlying tokens in an inflation period', async () => {
      const inflationPeriod = await keep3r.inflationPeriod();
      const expectedPeriodCredits = spentKp3rs.mul(rewardPeriodTime).div(inflationPeriod);

      expect(await keep3r.jobPeriodCredits(job.address)).to.be.closeTo(expectedPeriodCredits, toUnit(0.001).toNumber());
    });

    it('should max the total credits as long as the twap for all the liquidities stay the same', async () => {
      // wait 2 periods in order to have a stable twap & max amount of liquidity credits
      await evm.advanceTimeAndBlock(moment.duration(10, 'days').as('seconds'));
      const maxedCredits = await keep3r.jobLiquidityCredits(job.address);

      // even if you wait more, if the twap doesn't change, the credits should stay the same
      await evm.advanceTimeAndBlock(moment.duration(6, 'days').as('seconds'));
      expect(await keep3r.jobLiquidityCredits(job.address)).to.equal(maxedCredits);
    });

    it('should lose half of the credits after unbonding half of the liquidity', async () => {
      // wait some days in order for that liquidity to generate credits
      await evm.advanceTimeAndBlock(moment.duration(1, 'day').as('seconds'));

      const previousTotalJobCredits = await keep3r.totalJobCredits(job.address);
      // unbond half the liquidity and expect to have half the credits taken away
      await keep3r.connect(jobOwner).unbondLiquidityFromJob(job.address, pair.address, initialLiquidity.div(2));

      // using closeTo because of 1 second difference between views and expectation
      expect(await keep3r.totalJobCredits(job.address)).to.be.closeTo(previousTotalJobCredits.div(2), toUnit(0.005).toNumber());
    });

    it('should lose all of the credits after unbonding all of the liquidity', async () => {
      // wait some days in order for that liquidity to generate credits
      await evm.advanceTimeAndBlock(moment.duration(4, 'days').as('seconds'));

      // withdraw all the liquidity and expect to have all the credits taken away
      await keep3r.connect(jobOwner).unbondLiquidityFromJob(job.address, pair.address, toUnit(1));
      expect(await keep3r.jobLiquidityCredits(job.address)).to.be.equal(0);
    });

    it('should update currentCredits and reset rewardedAt when more liquidity is added', async () => {
      // wait some days in order for that liquidity to generate credits
      await evm.advanceTimeAndBlock(moment.duration(2, 'days').as('seconds'));

      const { liquidity } = await common.addLiquidityToPair(richGuy, pair, toUnit(1), jobOwner);
      await pair.connect(jobOwner).approve(keep3r.address, liquidity);
      await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);

      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

      expect(await keep3r.jobLiquidityCredits(job.address)).to.be.equal(await keep3r.totalJobCredits(job.address));
      expect(await keep3r.rewardedAt(job.address)).to.be.equal(blockTimestamp);
    });

    it('should reward jobLiquidityCredits and pay the keeper with them', async () => {
      let previousJobCredits: BigNumber;
      let previousTotalJobCredits: BigNumber;

      // wait some days in order for that liquidity to generate credits
      await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));

      previousJobCredits = await keep3r.jobLiquidityCredits(job.address);
      previousTotalJobCredits = await keep3r.totalJobCredits(job.address);

      await job.connect(keeper).work();

      expect(await keep3r.jobLiquidityCredits(job.address)).to.be.gt(previousJobCredits);
      expect((await keep3r.totalJobCredits(job.address)).sub((await keep3r.jobPeriodCredits(job.address)).div(rewardPeriodTime))).to.be.lt(
        previousTotalJobCredits
      );
    });
  });

  async function activateKeeper(keeper: Wallet) {
    await keep3r.connect(keeper).bond(common.KP3R_V1_ADDRESS, 0);
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(common.KP3R_V1_ADDRESS);
  }
});
