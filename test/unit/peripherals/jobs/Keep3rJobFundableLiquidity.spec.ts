import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IKeep3rV1,
  IKeep3rV1Proxy,
  IUniswapV3Pool,
  Keep3rHelper,
  Keep3rJobFundableLiquidityForTest,
  Keep3rJobFundableLiquidityForTest__factory,
  UniV3PairManager,
} from '@types';
import { behaviours, evm, wallet } from '@utils';
import { onlyJobOwner } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import { ZERO_ADDRESS } from '@utils/constants';
import { MathUtils, mathUtilsFactory } from '@utils/math';
import chai, { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';

chai.use(smock.matchers);

describe('Keep3rJobFundableLiquidity', () => {
  const randomJob = wallet.generateRandomAddress();
  let governance: SignerWithAddress;
  let provider: SignerWithAddress;
  let jobOwner: SignerWithAddress;
  let jobFundable: MockContract<Keep3rJobFundableLiquidityForTest>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let helper: FakeContract<Keep3rHelper>;
  let randomLiquidity: FakeContract<UniV3PairManager>;
  let approvedLiquidity: FakeContract<UniV3PairManager>;
  let jobFundableFactory: MockContractFactory<Keep3rJobFundableLiquidityForTest__factory>;
  let oraclePool: FakeContract<IUniswapV3Pool>;

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;
  let inflationPeriodTime: number;

  let mathUtils: MathUtils;
  let oneTick: number;
  let snapshotId: string;

  before(async () => {
    [governance, jobOwner, provider] = await ethers.getSigners();

    jobFundableFactory = await smock.mock<Keep3rJobFundableLiquidityForTest__factory>('Keep3rJobFundableLiquidityForTest');
    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');
    randomLiquidity = await smock.fake('UniV3PairManager');
    approvedLiquidity = await smock.fake('UniV3PairManager');
    oraclePool = await smock.fake('IUniswapV3Pool');
    helper.isKP3RToken0.returns(true);
    approvedLiquidity.transfer.returns(true);
    approvedLiquidity.transferFrom.returns(true);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);

    jobFundable = await jobFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address);

    await jobFundable.setVariable('jobOwner', {
      [randomJob]: jobOwner.address,
    });

    rewardPeriodTime = (await jobFundable.rewardPeriodTime()).toNumber();
    inflationPeriodTime = (await jobFundable.inflationPeriod()).toNumber();
    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
    const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const testPeriodTime = mathUtils.calcPeriod(blockTimestamp + rewardPeriodTime) + rewardPeriodTime / 2;
    // set the test to start mid-period
    evm.advanceToTime(testPeriodTime);
    evm.advanceBlock();

    oneTick = rewardPeriodTime;

    helper.observe.returns([0, 0, true]);
    helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => amount);

    // set oraclePool to be updated
    await jobFundable.setVariable('_tick', { [oraclePool.address]: { period: mathUtils.calcPeriod(testPeriodTime) } });

    // set and initialize approvedLiquidity
    await jobFundable.setApprovedLiquidity(approvedLiquidity.address);
    await jobFundable.setVariable('_liquidityPool', { [approvedLiquidity.address]: oraclePool.address });
    await jobFundable.setVariable('_isKP3RToken0', { [approvedLiquidity.address]: true });
  });

  describe('jobPeriodCredits', () => {
    const liquidityAmount = toUnit(1);

    beforeEach(async () => {
      await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
      await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAmount } });
    });

    context('when liquidity is updated', () => {
      beforeEach(async () => {
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should not call the oracle', async () => {
        await jobFundable.jobPeriodCredits(randomJob);
        expect(helper.observe).not.to.have.been.called;
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
      });
    });

    context('when liquidity is outdated', () => {
      beforeEach(async () => {
        helper.observe.reset();
        helper.observe.returns([0, 0, true]);

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobFundable.setVariable('_tick', {
          [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
        });
      });

      it('should call the oracle', async () => {
        await jobFundable.jobPeriodCredits(randomJob);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        expect(helper.observe).to.have.been.calledOnceWith(oraclePool.address, [blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
      });
    });

    context('when liquidity is expired', () => {
      beforeEach(async () => {
        helper.observe.reset();
        helper.observe.returns([0, 0, true]);

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobFundable.setVariable('_tick', {
          [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - 2 * rewardPeriodTime) },
        });
      });
      it('should call the oracle', async () => {
        await jobFundable.jobPeriodCredits(randomJob);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(helper.observe).to.have.been.calledOnceWith(oraclePool.address, [
          blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
          blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
        ]);
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
      });
    });

    context('when liquidity twap has changed', () => {
      let oldCreditsForComparison: BigNumber;
      beforeEach(async () => {
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        const liquidityParams = {
          current: 0,
          difference: 0,
          period: mathUtils.calcPeriod(blockTimestamp),
        };

        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: liquidityParams });

        oldCreditsForComparison = mathUtils.calcPeriodCredits(toUnit(1));

        await jobFundable.setVariable('_tick', {
          [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
        });
      });

      // If KP3R price went up, previous credits are worth less KP3Rs
      it('should return an decreased amount if increased', async () => {
        helper.observe.returns([rewardPeriodTime, 0, true]);
        await jobFundable.setVariable('_isKP3RToken0', { [approvedLiquidity.address]: true });

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(
          mathUtils.decrease1Tick(oldCreditsForComparison),
          mathUtils.blockShiftPrecision
        );
      });

      it('should return an increased amount if decreased', async () => {
        helper.observe.returns([-rewardPeriodTime, 0, true]);

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(
          mathUtils.increase1Tick(oldCreditsForComparison),
          mathUtils.blockShiftPrecision
        );
      });
    });

    context('when there are more than 1 liquidities', () => {
      const liquidityAmount = toUnit(1);
      beforeEach(async () => {
        randomLiquidity.token0.returns(keep3rV1.address);

        await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
        await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [randomLiquidity.address]: liquidityAmount } });

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
        await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should return a full period for each liquidity', async () => {
        const expectedCredits1 = mathUtils.calcPeriodCredits(liquidityAmount);
        const expectedCredits2 = mathUtils.calcPeriodCredits(liquidityAmount);

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits1.add(expectedCredits2));
      });
    });
  });

  describe('jobLiquidityCredits', () => {
    let blockTimestamp: number;

    beforeEach(async () => {
      await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
      await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
      await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: toUnit(1) });
      await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: toUnit(1) });

      blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

      let tickSetting = {
        current: rewardPeriodTime,
        difference: rewardPeriodTime,
        period: mathUtils.calcPeriod(blockTimestamp),
      };

      await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
      helper.observe.returns([rewardPeriodTime, 0, true]);
    });

    context('when job accountance is updated', () => {
      beforeEach(async () => {
        await jobFundable.setVariable('workedAt', { [randomJob]: blockTimestamp });
        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should return current job credits', async () => {
        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(
          mathUtils.calcPeriodCredits(toUnit(1)),
          mathUtils.blockShiftPrecision
        );
      });
    });

    context('when job accountance is outdated', () => {
      beforeEach(async () => {
        await jobFundable.setVariable('workedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });

        let tickSetting = {
          current: rewardPeriodTime,
          difference: rewardPeriodTime,
          period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
        };
        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });

        helper.observe.returns([2 * rewardPeriodTime, rewardPeriodTime, true]);
      });

      it('should return old job credits updated to current price', async () => {
        const previousPeriodCredits = mathUtils.calcPeriodCredits(toUnit(1));
        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(
          mathUtils.increase1Tick(previousPeriodCredits),
          mathUtils.blockShiftPrecision
        );
      });
    });

    context('when job accountance is expired', () => {
      beforeEach(async () => {
        await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - 2 * rewardPeriodTime });
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(expectedCredits, mathUtils.blockShiftPrecision);
      });
    });
  });

  describe('totalJobCredits', () => {
    let blockTimestamp: number;
    const liquidityAdded: BigNumber = toUnit(1);
    let jobPeriodCredits: BigNumber;

    it('should return 0 with an empty job', async () => {
      expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(0);
    });

    context('when job has only forced credits', () => {
      beforeEach(async () => {
        await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: toUnit(1) });
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      });

      it('should return forced credits if are updated', async () => {
        await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp });
        expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(toUnit(1));
      });

      it('should return 0 if forced credits are outdated', async () => {
        await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });
        expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(0);
      });
    });

    context('when job has added liquidity', () => {
      beforeEach(async () => {
        jobPeriodCredits = mathUtils.calcPeriodCredits(liquidityAdded);
        await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
        await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: jobPeriodCredits });

        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      });

      context('when job was rewarded this period', () => {
        beforeEach(async () => {
          helper.observe.reset();
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
          await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });
          // if job accountance is updated, then it's liquidity must updated be as well
          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
        });

        it('should not call the oracle', async () => {
          await jobFundable.totalJobCredits(randomJob);
          expect(helper.observe).not.to.have.been.called;
        });

        it('should return current credits + minted since period start', async () => {
          const jobLiquidityCredits = await jobFundable.jobLiquidityCredits(randomJob);

          expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(
            jobLiquidityCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp)))
          );
        });

        context('when job was rewarded after period started', () => {
          let rewardTimestamp: number;
          beforeEach(async () => {
            rewardTimestamp = Math.floor((mathUtils.calcPeriod(blockTimestamp) + blockTimestamp) / 2);
            await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
          });

          it('should return current credits + minted since reward reference', async () => {
            const jobLiquidityCredits = await jobFundable.jobLiquidityCredits(randomJob);

            expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(
              jobLiquidityCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - rewardTimestamp))
            );
          });
        });
      });

      context('when job was rewarded last period', () => {
        let oldLiquidityCredits: BigNumber;

        beforeEach(async () => {
          oldLiquidityCredits = mathUtils.calcPeriodCredits(toUnit(1));
          await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: oldLiquidityCredits });
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
          await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });
        });

        it('should call the oracle', async () => {
          await jobFundable.totalJobCredits(randomJob);
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          expect(helper.observe).to.have.been.calledWith(oraclePool.address, [
            blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
            blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
          ]);
        });

        it('should return updated credits + minted since period start', async () => {
          const totalJobCredits = await jobFundable.totalJobCredits(randomJob);
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          expect(totalJobCredits).to.be.closeTo(
            mathUtils
              .decrease1Tick(oldLiquidityCredits)
              .add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp))),
            mathUtils.blockShiftPrecision
          );
        });

        context('when job was rewarded after period started', () => {
          let rewardTimestamp: number;
          beforeEach(async () => {
            blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            rewardTimestamp = Math.floor(mathUtils.calcPeriod(blockTimestamp) - rewardPeriodTime / 10);

            await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
            let tickSetting = {
              current: oneTick,
              difference: oneTick,
              period: mathUtils.calcPeriod(blockTimestamp),
            };

            await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
          });

          it('should return updated credits + minted since reward reference', async () => {
            const totalJobCredits = await jobFundable.totalJobCredits(randomJob);

            expect(totalJobCredits).to.be.closeTo(
              mathUtils
                .decrease1Tick(oldLiquidityCredits)
                .add(mathUtils.calcMintedCredits(mathUtils.decrease1Tick(oldLiquidityCredits), blockTimestamp - rewardTimestamp)),
              mathUtils.blockShiftPrecision
            );
          });
        });
      });

      context('when job was rewarded exactly 1 period ago', () => {
        beforeEach(async () => {
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
          await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });
          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
        });

        it('should return a full period of credits', async () => {
          const expectedCredits = mathUtils.calcPeriodCredits(liquidityAdded);

          expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(expectedCredits);
        });
      });

      context('when job was rewarded more than 1 period ago', () => {
        let rewardTimestamp: number;

        beforeEach(async () => {
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          rewardTimestamp = blockTimestamp - 1.1 * rewardPeriodTime;

          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
          await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
        });

        it('should return a full period of credits + minted sice reward reference', async () => {
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          expect(await jobFundable.totalJobCredits(randomJob)).to.be.closeTo(
            jobPeriodCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - (rewardTimestamp + rewardPeriodTime))),
            mathUtils.blockShiftPrecision
          );
        });
      });

      context('when job was rewarded more than 2 periods ago', () => {
        beforeEach(async () => {
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
          await jobFundable.setVariable('workedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp - 2 * rewardPeriodTime) });
          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: blockTimestamp - 2 * rewardPeriodTime } });
        });

        it('should return a full period of credits + minted since period start', async () => {
          expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(
            (await jobFundable.jobPeriodCredits(randomJob)).add(
              (await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - mathUtils.calcPeriod(blockTimestamp)).div(rewardPeriodTime)
            )
          );
        });
      });
    });
  });

  describe('quoteLiquidity', () => {
    beforeEach(async () => {
      helper.observe.reset();
    });

    it('should return 0 if liquidity is not approved', async () => {
      expect(await jobFundable.quoteLiquidity(randomLiquidity.address, toUnit(1))).to.be.eq(0);
    });

    it('should not call the oracle when liquidity is updated', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });

      await jobFundable.quoteLiquidity(approvedLiquidity.address, toUnit(1));
      expect(helper.observe).not.to.have.been.called;
    });

    it('should call the oracle when liquidity is outdated', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('_tick', {
        [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
      });

      await jobFundable.quoteLiquidity(approvedLiquidity.address, toUnit(1));
      expect(helper.observe).have.been.calledWith(oraclePool.address, [blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
    });

    it('should call the oracle when liquidity is expired', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.quoteLiquidity(approvedLiquidity.address, toUnit(1));
      expect(helper.observe).have.been.calledWith(oraclePool.address, [
        blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
        blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
      ]);
    });

    it('should quote the liquidity with reward calculation', async () => {
      /*
      // REWARD CALCULATION
      // twapCalculation: amountIn * 1.0001**(-difference/timeElapsed)
      // difference: rewardPeriodTime
      // timeElapsed: rewardPeriodTime
      // twapCalculation: amountIn / 1.0001
      //
      // rewardCalculation: twapCalculation * rewardPeriod / inflationPeriod
      */
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      const liquidityParams = {
        period: mathUtils.calcPeriod(blockTimestamp), // liquidity is updated
        difference: rewardPeriodTime, // = +1 tick per second since previous observation
        // as KP3R increases value, a liquidity unit should be rewarded with less KP3R
      };
      const amountIn = toUnit(1);
      await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: liquidityParams });
      expect(await jobFundable.quoteLiquidity(approvedLiquidity.address, amountIn)).to.be.closeTo(
        mathUtils.calcPeriodCredits(mathUtils.decrease1Tick(amountIn)),
        mathUtils.blockShiftPrecision
      );
    });
  });

  describe('observeLiquidity', () => {
    let blockTimestamp: number;
    beforeEach(async () => {
      helper.observe.reset();
      const liquidityParams = {
        current: 0,
        difference: 0,
      };
      await jobFundable.setVariable('_tick', { [randomLiquidity.address]: liquidityParams });
      blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    });

    context('when liquidity is updated', () => {
      let period: number;
      beforeEach(async () => {
        period = mathUtils.calcPeriod(blockTimestamp);
        await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: period } });
      });

      it('should return current tick', async () => {
        const observation = await jobFundable.observeLiquidity(randomLiquidity.address);

        expect(observation.current).to.eq(BigNumber.from(0));
        expect(observation.difference).to.eq(BigNumber.from(0));
        expect(observation.period).to.eq(period);
      });

      it('should not call the oracle', async () => {
        await jobFundable.observeLiquidity(randomLiquidity.address);
        expect(helper.observe).not.to.be.called;
      });
    });

    context('when liquidity is outdated', () => {
      let period: number;
      beforeEach(async () => {
        period = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
        await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: period } });
        await jobFundable.setVariable('_liquidityPool', { [randomLiquidity.address]: oraclePool.address });
        helper.observe.returns([1, 0, true]);
      });

      it('should return oracle tick and calculate difference', async () => {
        const observation = await jobFundable.observeLiquidity(randomLiquidity.address);

        expect(observation.current).to.eq(BigNumber.from(1));
        expect(observation.difference).to.eq(BigNumber.from(1));
        expect(observation.period).to.eq(mathUtils.calcPeriod(blockTimestamp));
      });

      it('should call the oracle', async () => {
        await jobFundable.observeLiquidity(randomLiquidity.address);
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        expect(helper.observe).to.have.be.calledWith(oraclePool.address, [blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
      });
    });

    context('when liquidity is expired', () => {
      beforeEach(async () => {
        helper.observe.returns([2, 1, true]);
      });
      it('should return oracle tick and difference', async () => {
        const observation = await jobFundable.observeLiquidity(approvedLiquidity.address);

        expect(observation.current).to.eq(BigNumber.from(2));
        expect(observation.difference).to.eq(BigNumber.from(1));
        expect(observation.period).to.eq(mathUtils.calcPeriod(blockTimestamp));
      });

      it('should call the oracle', async () => {
        await jobFundable.observeLiquidity(approvedLiquidity.address);
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(helper.observe).to.have.be.calledWith(oraclePool.address, [
          blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
          blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
        ]);
      });
    });
  });

  describe('forceLiquidityCreditsToJob', () => {
    behaviours.onlyGovernance(() => jobFundable, 'forceLiquidityCreditsToJob', governance, [randomJob, 1]);

    it('should revert when called with unallowed job', async () => {
      await expect(jobFundable.forceLiquidityCreditsToJob(randomJob, toUnit(1))).to.be.revertedWith('JobUnavailable()');
    });

    context('when job was approved', () => {
      beforeEach(async () => {
        await jobFundable.setJob(randomJob);
      });

      it('should reward job previously minted credits', async () => {
        const block = await ethers.provider.getBlock('latest');

        await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: toUnit(1) });
        await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(block.timestamp) });
        // The job has 0 credits but should be rewarded some
        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(0);

        await jobFundable.forceLiquidityCreditsToJob(randomJob, 0);

        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.gt(0);
      });

      it('should update last reward timestamp', async () => {
        await jobFundable.forceLiquidityCreditsToJob(randomJob, toUnit(1));
        const block = await ethers.provider.getBlock('latest');

        expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(block.timestamp);
      });

      it('should increase job liquidity credits', async () => {
        await jobFundable.forceLiquidityCreditsToJob(randomJob, toUnit(1));
        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.equal(toUnit(1));
      });

      it('should add liquidity credits that dont change value', async () => {
        await jobFundable.forceLiquidityCreditsToJob(randomJob, toUnit(1));
        helper.observe.returns([rewardPeriodTime, 0, true]);

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await jobFundable.setVariable('_tick', {
          [approvedLiquidity.address]: {
            current: 0,
            difference: 0,
            period: mathUtils.calcPeriod(blockTimestamp),
          },
        });

        await evm.advanceTimeAndBlock(rewardPeriodTime - 10);

        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.equal(toUnit(1));
      });

      it('should add liquidity credits that expire', async () => {
        await jobFundable.forceLiquidityCreditsToJob(randomJob, toUnit(1));
        await evm.advanceTimeAndBlock(rewardPeriodTime);

        expect(await jobFundable.jobLiquidityCredits(randomJob)).to.equal(0);
      });

      it('should emit event', async () => {
        const forcedLiquidityAmount = toUnit(1);
        const tx = await jobFundable.connect(governance).forceLiquidityCreditsToJob(randomJob, forcedLiquidityAmount);
        const rewardedAt = (await ethers.provider.getBlock('latest')).timestamp;

        await expect(tx).to.emit(jobFundable, 'LiquidityCreditsForced').withArgs(randomJob, rewardedAt, forcedLiquidityAmount);
      });
    });
  });

  describe('approveLiquidity', () => {
    behaviours.onlyGovernance(
      () => jobFundable,
      'approveLiquidity',
      governance,
      () => [approvedLiquidity.address]
    );

    it('should revert when liquidity already approved', async () => {
      await expect(jobFundable.connect(governance).approveLiquidity(approvedLiquidity.address)).to.be.revertedWith('LiquidityPairApproved()');
    });

    it('should add the liquidity to approved liquidities list', async () => {
      await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
      expect(await jobFundable.approvedLiquidities()).to.contain(randomLiquidity.address);
    });

    it('should sort the tokens in the liquidity pair', async () => {
      await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
      expect(await jobFundable.viewTickOrder(randomLiquidity.address)).to.be.true;
    });

    it('should initialize twap for liquidity', async () => {
      await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
      expect(helper.observe).to.have.been.called;
    });

    it('should emit event', async () => {
      await expect(jobFundable.connect(governance).approveLiquidity(randomLiquidity.address))
        .to.emit(jobFundable, 'LiquidityApproval')
        .withArgs(randomLiquidity.address);
    });
  });

  describe('revokeLiquidity', () => {
    behaviours.onlyGovernance(
      () => jobFundable,
      'revokeLiquidity',
      governance,
      () => [approvedLiquidity.address]
    );

    it('should not be able to remove unapproved liquidity', async () => {
      await expect(jobFundable.connect(governance).revokeLiquidity(randomLiquidity.address)).to.be.revertedWith('LiquidityPairUnexistent()');
    });

    it('should not be able to remove the same liquidity twice', async () => {
      await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
      await expect(jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address)).to.be.revertedWith('LiquidityPairUnexistent()');
    });

    it('should remove liquidity', async () => {
      await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
      expect(await jobFundable.approvedLiquidities()).not.to.contain(approvedLiquidity.address);
    });

    it('should not remove other liquidities', async () => {
      await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
      await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
      expect(await jobFundable.approvedLiquidities()).to.contain(randomLiquidity.address);
    });

    it('should avoid a revoked liquidity from minting new credits', async () => {
      await jobFundable.setJob(randomJob);
      await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(10));

      expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.gt(0);
      await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
      expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(toUnit(0));
    });

    it('should emit event', async () => {
      await expect(jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address))
        .to.emit(jobFundable, 'LiquidityRevocation')
        .withArgs(approvedLiquidity.address);
    });
  });

  describe('addLiquidityToJob', () => {
    it('should revert when liquidity pair is not accepted', async () => {
      await expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, randomLiquidity.address, toUnit(1))).to.be.revertedWith(
        'LiquidityPairUnapproved()'
      );
    });

    it('should revert when job is not accepted', async () => {
      await expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1))).to.be.revertedWith(
        'JobUnavailable()'
      );
    });

    context('when liquidity pair and job are accepted', async () => {
      beforeEach(async () => {
        await jobFundable.setJob(randomJob);
        approvedLiquidity.transferFrom.reset();
        approvedLiquidity.transferFrom.returns(true);
      });

      it('should revert when transfer reverts', async () => {
        approvedLiquidity.transferFrom.returns(false);
        const liquidityToAdd = mathUtils.calcLiquidityToAdd(toUnit(1));
        await expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd)).to.be.revertedWith(
          'ERC20 operation did not succeed'
        );
      });

      it('should revert if the amount is less than the minimum', async () => {
        await expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(0.49))).to.be.revertedWith(
          'JobLiquidityLessThanMin()'
        );
      });

      it('should not revert when adding a tiny amount of liquidity if the minimum is already satisfied', async () => {
        const liquidityToAdd = mathUtils.calcLiquidityToAdd(toUnit(1));

        await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
        await expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(0.01))).not.to.be.revertedWith(
          'JobLiquidityLessThanMin()'
        );
      });

      it('should transfer the liquidity tokens to contract', async () => {
        const liquidityToAdd = mathUtils.calcLiquidityToAdd(toUnit(1));

        await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
        expect(approvedLiquidity.transferFrom).to.be.calledOnceWith(provider.address, jobFundable.address, liquidityToAdd);
      });

      it('should add liquidity amount to balance', async () => {
        const liquidityToAdd = mathUtils.calcLiquidityToAdd(toUnit(1));

        await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
        expect(await jobFundable.liquidityAmount(randomJob, approvedLiquidity.address)).to.equal(liquidityToAdd);
      });

      it('should update last reward timestamp', async () => {
        const liquidityToAdd = mathUtils.calcLiquidityToAdd(toUnit(1));

        await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(blockTimestamp);
      });

      it('should update job period credits for job', async () => {
        const jobLiquidityAmount = toUnit(10);
        const calculatedJobPeriodCredits = mathUtils.calcPeriodCredits(jobLiquidityAmount);

        await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: 0 });
        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: jobLiquidityAmount } });

        await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, 0);

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(calculatedJobPeriodCredits);
      });

      it('should emit event', async () => {
        const liquidityToAdd = mathUtils.calcLiquidityToAdd(toUnit(1));

        const tx = await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);

        await expect(tx)
          .to.emit(jobFundable, 'LiquidityAddition')
          .withArgs(randomJob, approvedLiquidity.address, provider.address, liquidityToAdd);
      });

      context('when there was previous liquidity', () => {
        beforeEach(async () => {
          const previousJobLiquidityAmount = toUnit(10);
          await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: previousJobLiquidityAmount } });
          await jobFundable.setVariable('_jobPeriodCredits', {
            [randomJob]: mathUtils.calcPeriodCredits(previousJobLiquidityAmount),
          });
        });

        it('should settle current credits debt of previous liquidity', async () => {
          await evm.advanceTimeAndBlock(moment.duration(1, 'days').as('seconds'));

          await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1));
          let totalCredits = await jobFundable.totalJobCredits(randomJob);
          expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(totalCredits);
        });
      });

      context('when liquidity twaps are outdated', () => {
        let previousJobLiquidityAmount: BigNumber;

        beforeEach(async () => {
          const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          previousJobLiquidityAmount = toUnit(10);

          await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: previousJobLiquidityAmount } });
          await jobFundable.setVariable('rewardedAt', { [randomJob]: 0 });
          await jobFundable.setVariable('_jobPeriodCredits', {
            [randomJob]: mathUtils.calcPeriodCredits(previousJobLiquidityAmount),
          });

          let tickSetting = {
            period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
          };

          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
        });

        it('should update twaps for liquidity', async () => {
          await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1));
          expect(helper.observe).to.have.been.called;
        });

        it('should recalculate previous credits to current prices', async () => {
          helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => {
            return mathUtils.decrease1Tick(amount);
          });

          let previousJobCredits = mathUtils.calcPeriodCredits(previousJobLiquidityAmount);

          await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1));

          expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(
            mathUtils.decrease1Tick(previousJobCredits),
            mathUtils.blockShiftPrecision
          );
        });
      });
    });
  });

  describe('unbondLiquidityFromJob', () => {
    beforeEach(async () => {
      helper.observe.reset();
      helper.observe.returns([rewardPeriodTime, 0, true]);
    });

    onlyJobOwner(
      () => jobFundable,
      'unbondLiquidityFromJob',
      jobOwner,
      () => [randomJob, approvedLiquidity.address, toUnit(1)]
    );

    it('should revert if job doesnt have the requested liquidity', async () => {
      await expect(jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, toUnit(1))).to.be.revertedWith(
        'JobLiquidityUnexistent()'
      );
    });

    context('when job has requested liquidity', () => {
      const jobLiquidityAmount = toUnit(1);

      beforeEach(async () => {
        await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);

        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: jobLiquidityAmount } });
        await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: jobLiquidityAmount });
        await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: jobLiquidityAmount });
      });

      it('should revert if trying to withdraw more liquidity than the job has', async () => {
        await expect(
          jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount.add(1))
        ).to.be.revertedWith('JobLiquidityInsufficient()');
      });

      it('should not reset last reward timestamp', async () => {
        const previousRewardedAt = await jobFundable.rewardedAt(randomJob);
        await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);

        expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(previousRewardedAt);
      });

      it('should remove liquidity from job if all is unbonded', async () => {
        await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);

        expect(await jobFundable.internalJobLiquidities(randomJob)).to.deep.equal([]);
      });

      it('should update the period job accountance', async () => {
        await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
        expect(await jobFundable.jobPeriodCredits(randomJob)).to.equal(0);
      });

      it('should unbond the liquidity', async () => {
        await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
        expect(await jobFundable.callStatic.pendingUnbonds(randomJob, approvedLiquidity.address)).to.equal(jobLiquidityAmount);
      });

      it('should lock the unbonded liquidity', async () => {
        await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        const expectedLockTime = blockTimestamp + moment.duration(14, 'days').as('seconds');

        expect(await jobFundable.callStatic.canWithdrawAfter(randomJob, approvedLiquidity.address)).to.equal(expectedLockTime);
      });

      it('should emit event', async () => {
        const tx = await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);

        await expect(tx).to.emit(jobFundable, 'Unbonding').withArgs(randomJob, approvedLiquidity.address, jobLiquidityAmount);
      });

      context('when liquidity is revoked', () => {
        let revokedLiquidity: FakeContract<UniV3PairManager>;

        beforeEach(async () => {
          await jobFundable.setRevokedLiquidity(approvedLiquidity.address);
          revokedLiquidity = approvedLiquidity;
        });

        it('should be able to unbond', async () => {
          await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, revokedLiquidity.address, jobLiquidityAmount);
          expect(await jobFundable.callStatic.pendingUnbonds(randomJob, approvedLiquidity.address)).to.be.gt(0);
        });
      });
    });
  });

  describe('withdrawLiquidityFromJob', () => {
    let initialLiquidityAmount: BigNumber = toUnit(1);

    beforeEach(async () => {
      await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: initialLiquidityAmount } });
      await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: toUnit(1) });
      await jobFundable.setVariable('rewardedAt', { [randomJob]: 0 });

      helper.observe.reset();
      helper.observe.returns([rewardPeriodTime, 0, true]);
    });

    onlyJobOwner(
      () => jobFundable,
      'withdrawLiquidityFromJob',
      jobOwner,
      () => [randomJob, approvedLiquidity.address, jobOwner.address]
    );

    it('should revert if never unbonded', async () => {
      await expect(
        jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address)
      ).to.be.revertedWith('UnbondsUnexistent()');
    });

    it('should revert if unbonded tokens are still locked', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('pendingUnbonds', {
        [randomJob]: { [approvedLiquidity.address]: toUnit(1) },
      });
      await jobFundable.setVariable('canWithdrawAfter', {
        [randomJob]: { [approvedLiquidity.address]: blockTimestamp + moment.duration('1', 'hour').asSeconds() },
      });
      await expect(
        jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address)
      ).to.be.revertedWith('UnbondsLocked()');
    });

    it('should revert when receiver is zero address', async () => {
      await expect(
        jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, ZERO_ADDRESS)
      ).to.be.revertedWith('ZeroAddress()');
    });

    context('when unbonded tokens and waited', () => {
      const unbondedAmount = toUnit(1);

      beforeEach(async () => {
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        await jobFundable.setVariable('canWithdrawAfter', {
          [randomJob]: { [approvedLiquidity.address]: blockTimestamp },
        });
        await jobFundable.setVariable('pendingUnbonds', {
          [randomJob]: { [approvedLiquidity.address]: unbondedAmount },
        });
      });

      it('should revert if job is disputed', async () => {
        await jobFundable.setVariable('disputes', {
          [randomJob]: true,
        });
        await expect(
          jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address)
        ).to.be.revertedWith('Disputed()');
      });

      it('should transfer unbonded liquidity to the receiver', async () => {
        await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, governance.address);
        expect(approvedLiquidity.transfer).to.have.been.calledOnceWith(governance.address, unbondedAmount);
      });

      it('should emit event', async () => {
        const tx = await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address);

        await expect(tx)
          .to.emit(jobFundable, 'LiquidityWithdrawal')
          .withArgs(randomJob, approvedLiquidity.address, jobOwner.address, unbondedAmount);
      });

      it('should reset the pending unbond amount', async () => {
        await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address);
        expect(await jobFundable.pendingUnbonds(randomJob, approvedLiquidity.address)).to.equal(0);
      });
    });
  });

  describe('_settleJobAccountance', () => {
    let calculatedJobPeriodCredits: BigNumber;
    let blockTimestamp: number;

    beforeEach(async () => {
      const jobLiquidityAmount = toUnit(10);
      calculatedJobPeriodCredits = mathUtils.calcPeriodCredits(jobLiquidityAmount);

      await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
      await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: calculatedJobPeriodCredits });
      await jobFundable.setVariable('_liquidityPool', { [approvedLiquidity.address]: oraclePool.address });
      await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: jobLiquidityAmount } });

      blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    });

    it('should update job credits to current quote', async () => {
      helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => {
        return mathUtils.decrease1Tick(amount);
      });

      await jobFundable.connect(provider).internalJobLiquidities(randomJob);

      expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(
        mathUtils.decrease1Tick(calculatedJobPeriodCredits),
        mathUtils.blockShiftPrecision
      );
    });

    it('should reward all job pending credits', async () => {
      await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: calculatedJobPeriodCredits });
      await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });
      // The job has 0 credits but should be rewarded some
      expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(0);

      await jobFundable.internalSettleJobAccountance(randomJob);

      expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.gt(0);
    });

    it('should max the possible credits to 1 period', async () => {
      await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: calculatedJobPeriodCredits });
      await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: calculatedJobPeriodCredits });
      await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });

      await jobFundable.internalSettleJobAccountance(randomJob);

      expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(calculatedJobPeriodCredits);
    });

    it('should set job reward timestamp to current timestamp', async () => {
      await jobFundable.internalSettleJobAccountance(randomJob);
      blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

      expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(blockTimestamp);
    });
  });
});
