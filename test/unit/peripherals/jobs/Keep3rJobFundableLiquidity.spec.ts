import IUniswapV3PoolForTestArtifact from '@contracts/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import IKeep3rV1Artifact from '@contracts/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rV1ProxyArtifact from '@contracts/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import IKeep3rHelperArtifact from '@contracts/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IKeep3rV1,
  IKeep3rV1Proxy,
  IUniswapV3Pool,
  Keep3rHelper,
  Keep3rJobFundableLiquidityForTest,
  Keep3rJobFundableLiquidityForTest__factory,
  Keep3rLibrary,
  UniV3PairManager,
} from '@types';
import { behaviours, evm, wallet } from '@utils';
import { onlyJobOwner } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
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
  let library: Keep3rLibrary;

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;
  let inflationPeriodTime: number;

  let mathUtils: MathUtils;

  before(async () => {
    [governance, jobOwner, provider] = await ethers.getSigners();
    library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as any as Keep3rLibrary;
    jobFundableFactory = await smock.mock<Keep3rJobFundableLiquidityForTest__factory>('Keep3rJobFundableLiquidityForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
  });

  beforeEach(async () => {
    helper = await smock.fake(IKeep3rHelperArtifact);
    keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    randomLiquidity = await smock.fake('UniV3PairManager');
    approvedLiquidity = await smock.fake('UniV3PairManager');
    oraclePool = await smock.fake(IUniswapV3PoolForTestArtifact);
    oraclePool.token0.returns(keep3rV1.address);
    approvedLiquidity.transfer.returns(true);
    approvedLiquidity.transferFrom.returns(true);

    jobFundable = await jobFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);

    await jobFundable.setVariable('jobOwner', {
      [randomJob]: jobOwner.address,
    });

    rewardPeriodTime = (await jobFundable.rewardPeriodTime()).toNumber();
    inflationPeriodTime = (await jobFundable.inflationPeriod()).toNumber();
    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);

    oraclePool.observe.returns([[0, 0], []]);
    approvedLiquidity.pool.returns(oraclePool.address);
    approvedLiquidity.token0.returns(keep3rV1.address);
    randomLiquidity.pool.returns(oraclePool.address);
    randomLiquidity.token0.returns(keep3rV1.address);

    // set oraclePool to be updated
    const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    await jobFundable.setVariable('_tick', { [oraclePool.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
    await jobFundable.connect(governance).approveLiquidity(approvedLiquidity.address);
  });

  describe('jobPeriodCredits', () => {
    beforeEach(async () => {
      await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
      await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
    });

    context('when liquidity is updated', () => {
      beforeEach(async () => {
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should not call the oracle', async () => {
        await jobFundable.jobPeriodCredits(randomJob);
        expect(oraclePool.observe).not.to.have.been.called;
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
      });
    });

    context('when liquidity is outdated', () => {
      beforeEach(async () => {
        oraclePool.observe.reset();
        oraclePool.observe.returns([[0, 0], []]);

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobFundable.setVariable('_tick', {
          [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
        });
      });

      it('should call the oracle', async () => {
        await jobFundable.jobPeriodCredits(randomJob);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        expect(oraclePool.observe).to.have.been.calledOnceWith([blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
      });
    });

    context('when liquidity is expired', () => {
      beforeEach(async () => {
        oraclePool.observe.reset();
        oraclePool.observe.returns([[0, 0], []]);

        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobFundable.setVariable('_tick', {
          [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - 2 * rewardPeriodTime) },
        });
      });
      it('should call the oracle', async () => {
        await jobFundable.jobPeriodCredits(randomJob);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(oraclePool.observe).to.have.been.calledOnceWith([
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
        oraclePool.observe.returns([[rewardPeriodTime, 0], []]);
        await jobFundable.setVariable('_isKP3RToken0', { [approvedLiquidity.address]: true });

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(mathUtils.decrease1Tick(oldCreditsForComparison), 1);
      });

      it('should return an increased amount if decreased', async () => {
        oraclePool.observe.returns([[-rewardPeriodTime, 0], []]);

        expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(mathUtils.increase1Tick(oldCreditsForComparison), 1);
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
      oraclePool.observe.returns([[rewardPeriodTime, 0], []]);
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

        oraclePool.observe.returns([[2 * rewardPeriodTime, rewardPeriodTime], []]);
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
    beforeEach(async () => {
      await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);

      // A job can have liquidity credits & no liquidity amount (forced by gov)
      await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: toUnit(1) });
      await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: toUnit(1) });
      await jobFundable.setVariable('_isKP3RToken0', { [approvedLiquidity.address]: true });

      blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    });

    context('when job was rewarded this period', () => {
      beforeEach(async () => {
        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
        await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });
        // if job accountance is updated, then it's liquidity must updated be as well
        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should not call the oracle', async () => {
        await jobFundable.totalJobCredits(randomJob);
        expect(oraclePool.observe).not.to.have.been.called;
      });

      it('should return current credits + minted since period start', async () => {
        expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(
          (await jobFundable.jobLiquidityCredits(randomJob)).add(
            (await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - mathUtils.calcPeriod(blockTimestamp)).div(rewardPeriodTime)
          )
        );
      });

      context('when job was rewarded after period started', () => {
        let rewardTimestamp: number;
        beforeEach(async () => {
          rewardTimestamp = mathUtils.calcPeriod(blockTimestamp) + rewardPeriodTime / 10;
          await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
        });

        it('should return current credits + minted since reward reference', async () => {
          expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(
            (await jobFundable.jobLiquidityCredits(randomJob)).add(
              (await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - rewardTimestamp).div(rewardPeriodTime)
            )
          );
        });
      });
    });

    context('when job was rewarded last period', () => {
      let oldLiquidityCredits: BigNumber;

      beforeEach(async () => {
        oldLiquidityCredits = mathUtils.calcPeriodCredits(toUnit(1));
        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
        await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });
      });

      it('should call the oracle', async () => {
        await jobFundable.totalJobCredits(randomJob);
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        expect(oraclePool.observe).to.have.been.calledWith([
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
            .add(
              (await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - mathUtils.calcPeriod(blockTimestamp)).div(rewardPeriodTime)
            ),
          mathUtils.blockShiftPrecision
        );
      });

      context('when job was rewarded after period started', () => {
        let rewardTimestamp: number;
        beforeEach(async () => {
          rewardTimestamp = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) + rewardPeriodTime / 10;

          await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(rewardTimestamp) } });
        });

        it('should return updated credits + minted since reward reference', async () => {
          const totalJobCredits = await jobFundable.totalJobCredits(randomJob);
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          expect(totalJobCredits).to.be.closeTo(
            mathUtils
              .decrease1Tick(oldLiquidityCredits)
              .add(
                (await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - (rewardTimestamp + rewardPeriodTime)).div(rewardPeriodTime)
              ),
            mathUtils.blockShiftPrecision
          );
        });
      });
    });

    context('when job was rewarded exactly 1 period ago', () => {
      beforeEach(async () => {
        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
        await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });
        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should return a full period of credits', async () => {
        const expectedCredits = mathUtils.calcPeriodCredits(toUnit(1));

        expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(expectedCredits);
      });
    });

    context('when job was rewarded more than 1 period ago', () => {
      let rewardTimestamp: number;

      beforeEach(async () => {
        rewardTimestamp = blockTimestamp - 1.1 * rewardPeriodTime;

        await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: toUnit(1) } });
        await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      it('should return a full period of credits + minted sice reward reference', async () => {
        expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(
          (await jobFundable.jobPeriodCredits(randomJob)).add(
            (await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - (rewardTimestamp + rewardPeriodTime)).div(rewardPeriodTime)
          )
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

  describe('quoteLiquidity', () => {
    it('should return 0 if liquidity is not approved', async () => {
      expect(await jobFundable.quoteLiquidity(randomLiquidity.address, toUnit(1))).to.be.eq(0);
    });

    it('should not call the oracle when liquidity is updated', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });

      await jobFundable.quoteLiquidity(approvedLiquidity.address, toUnit(1));
      expect(oraclePool.observe).not.to.have.been.called;
    });

    it('should call the oracle when liquidity is outdated', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('_tick', {
        [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
      });

      await jobFundable.quoteLiquidity(approvedLiquidity.address, toUnit(1));
      expect(oraclePool.observe).have.been.calledWith([blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
    });

    it('should call the oracle when liquidity is expired', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.quoteLiquidity(approvedLiquidity.address, toUnit(1));
      expect(oraclePool.observe).have.been.calledWith([
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
      expect(await jobFundable.quoteLiquidity(approvedLiquidity.address, amountIn)).to.be.eq(
        mathUtils.calcPeriodCredits(mathUtils.decrease1Tick(amountIn))
      );
    });
  });

  describe('observeLiquidity', () => {
    let blockTimestamp: number;
    beforeEach(async () => {
      oraclePool.observe.reset();
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
        expect(await jobFundable.observeLiquidity(randomLiquidity.address)).to.deep.equal([
          BigNumber.from(0),
          BigNumber.from(0),
          BigNumber.from(period),
        ]);
      });
      it('should not call the oracle', async () => {
        await jobFundable.observeLiquidity(randomLiquidity.address);
        expect(oraclePool.observe).not.to.be.called;
      });
    });
    context('when liquidity is outdated', () => {
      let period: number;
      beforeEach(async () => {
        period = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
        await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: period } });
        await jobFundable.setVariable('_liquidityPool', { [randomLiquidity.address]: oraclePool.address });
        oraclePool.observe.returns([[1], []]);
      });
      it('should return oracle tick and calculate difference', async () => {
        expect(await jobFundable.observeLiquidity(randomLiquidity.address)).to.deep.equal([
          BigNumber.from(1),
          BigNumber.from(1),
          BigNumber.from(mathUtils.calcPeriod(blockTimestamp)),
        ]);
      });
      it('should call the oracle', async () => {
        await jobFundable.observeLiquidity(randomLiquidity.address);
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        expect(oraclePool.observe).to.have.be.calledWith([blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
      });
    });
    context('when liquidity is expired', () => {
      beforeEach(async () => {
        oraclePool.observe.returns([[2, 1], []]);
      });
      it('should return oracle tick and difference', async () => {
        expect(await jobFundable.observeLiquidity(approvedLiquidity.address)).to.deep.equal([
          BigNumber.from(2),
          BigNumber.from(1),
          BigNumber.from(mathUtils.calcPeriod(blockTimestamp)),
        ]);
      });
      it('should call the oracle', async () => {
        await jobFundable.observeLiquidity(approvedLiquidity.address);
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(oraclePool.observe).to.have.be.calledWith([
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

      it('should emit event', async () => {
        const tx = await jobFundable.connect(governance).forceLiquidityCreditsToJob(randomJob, toUnit(1));
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await expect(tx).to.emit(jobFundable, 'JobCreditsUpdated').withArgs(randomJob, blockTimestamp, toUnit(1));
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
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await expect(tx)
          .to.emit(jobFundable, 'LiquidityAddition')
          .withArgs(randomJob, approvedLiquidity.address, provider.address, blockTimestamp, liquidityToAdd);
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
          let previousTotalCredits = await jobFundable.totalJobCredits(randomJob);

          await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1));
          expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(previousTotalCredits);
        });
      });

      context('when liquidity twaps are outdated', () => {
        beforeEach(async () => {
          const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          const previousJobLiquidityAmount = toUnit(10);

          await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
          await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: previousJobLiquidityAmount } });
          await jobFundable.setVariable('rewardedAt', { [randomJob]: 0 });
          await jobFundable.setVariable('_jobPeriodCredits', {
            [randomJob]: mathUtils.calcPeriodCredits(previousJobLiquidityAmount),
          });

          let tickSetting = {
            // current: rewardPeriodTime,
            // previous: 0,
            period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
          };

          await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
        });

        it('should update twaps for liquidity', async () => {
          await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1));
          expect(oraclePool.observe).to.have.been.called;
        });
        it('should recalculate previous current credits to current prices', async () => {
          let previousJobCredits = await jobFundable.jobLiquidityCredits(randomJob);

          let previousTwapDifference: BigNumber = BigNumber.from(1);

          await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, toUnit(1));
          let currentTwapCache = await jobFundable.viewTickCache(approvedLiquidity.address);
          let currentTwapDifference: BigNumber = currentTwapCache[0].sub(currentTwapCache[1]);

          expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(
            previousJobCredits.mul(currentTwapDifference).div(previousTwapDifference)
          );
        });
      });
    });
  });

  describe('unbondLiquidityFromJob', () => {
    beforeEach(async () => {
      oraclePool.observe.reset();
      oraclePool.observe.returns([[rewardPeriodTime, 0], []]);
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
        const canWithdrawAfter = await jobFundable.callStatic.canWithdrawAfter(randomJob, approvedLiquidity.address);
        const blockNumber = (await ethers.provider.getBlock('latest')).number;

        await expect(tx).to.emit(jobFundable, 'Unbonding').withArgs(randomJob, blockNumber, canWithdrawAfter, jobLiquidityAmount);
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

      oraclePool.observe.reset();
      oraclePool.observe.returns([[rewardPeriodTime, 0], []]);
    });

    onlyJobOwner(
      () => jobFundable,
      'withdrawLiquidityFromJob',
      jobOwner,
      () => [randomJob, approvedLiquidity.address]
    );

    it('should revert if never unbonded', async () => {
      await expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address)).to.be.revertedWith(
        'UnbondsUnexistent()'
      );
    });

    it('should revert if unbonded tokens are still locked', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('canWithdrawAfter', {
        [randomJob]: { [approvedLiquidity.address]: blockTimestamp + moment.duration('1', 'hour').asSeconds() },
      });
      await expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address)).to.be.revertedWith(
        'UnbondsLocked()'
      );
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
        await expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address)).to.be.revertedWith(
          'Disputed()'
        );
      });

      it('should transfer unbonded liquidity to the job owner', async () => {
        await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address);
        expect(approvedLiquidity.transfer).to.have.been.calledOnceWith(jobOwner.address, unbondedAmount);
      });

      it('should emit event', async () => {
        const tx = await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address);
        const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(tx)
          .to.emit(jobFundable, 'LiquidityWithdrawal')
          .withArgs(randomJob, approvedLiquidity.address, jobOwner.address, blockTimestamp, unbondedAmount);
      });

      it('should reset the pending unbond amount', async () => {
        await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address);
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
      const oneTick = rewardPeriodTime;
      oraclePool.observe.returns([[oneTick, 0], []]);

      let tickSetting = {
        current: oneTick,
        difference: oneTick,
        period: mathUtils.calcPeriod(blockTimestamp),
      };

      await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });

      await jobFundable.connect(provider).internalJobLiquidities(randomJob);

      expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(mathUtils.decrease1Tick(calculatedJobPeriodCredits));
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
