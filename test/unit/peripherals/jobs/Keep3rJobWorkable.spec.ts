import IUniswapV3PoolForTestArtifact from '@contracts/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import IKeep3rV1Artifact from '@contracts/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rV1ProxyArtifact from '@contracts/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import IKeep3rHelperArtifact from '@contracts/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import ERC20Artifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import {
  ERC20,
  IKeep3rV1,
  IKeep3rV1Proxy,
  IUniswapV3PoolForTest,
  Keep3rHelper,
  Keep3rJobWorkableForTest,
  Keep3rJobWorkableForTest__factory,
  Keep3rLibrary,
} from '@types';
import { evm } from '@utils';
import { toGwei, toUnit } from '@utils/bn';
import { MathUtils, mathUtilsFactory } from '@utils/math';
import chai, { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';

chai.use(smock.matchers);

describe('Keep3rJobWorkable', () => {
  let jobWorkable: MockContract<Keep3rJobWorkableForTest>;
  let helper: FakeContract<Keep3rHelper>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let randomLiquidity: FakeContract<IUniswapV3PoolForTest>;
  let randomKeeper: SignerWithAddress;
  let approvedJob: SignerWithAddress;
  let jobWorkableFactory: MockContractFactory<Keep3rJobWorkableForTest__factory>;
  let kp3rWethPool: FakeContract<IUniswapV3PoolForTest>;
  let oraclePool: FakeContract<IUniswapV3PoolForTest>;
  let library: Keep3rLibrary;

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;
  let inflationPeriodTime: number;

  let mathUtils: MathUtils;

  before(async () => {
    [, randomKeeper, approvedJob] = await ethers.getSigners();
    library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as any as Keep3rLibrary;
    jobWorkableFactory = await smock.mock('Keep3rJobWorkableForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
  });

  beforeEach(async () => {
    helper = await smock.fake(IKeep3rHelperArtifact);
    keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    randomLiquidity = await smock.fake(IUniswapV3PoolForTestArtifact);
    oraclePool = await smock.fake(IUniswapV3PoolForTestArtifact);
    kp3rWethPool = await smock.fake(IUniswapV3PoolForTestArtifact);
    oraclePool.token0.returns(keep3rV1.address);
    kp3rWethPool.token0.returns(keep3rV1.address);

    jobWorkable = await jobWorkableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, kp3rWethPool.address);

    await jobWorkable.setJob(approvedJob.address);

    rewardPeriodTime = (await jobWorkable.rewardPeriodTime()).toNumber();
    inflationPeriodTime = (await jobWorkable.inflationPeriod()).toNumber();

    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);

    // set kp3rWethPool to be set and updated
    const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    await jobWorkable.setVariable('_tick', { [kp3rWethPool.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
    kp3rWethPool.observe.returns([[0, 0], []]);
  });

  describe('isKeeper', () => {
    it('should return false if keeper is not registered', async () => {
      expect(await jobWorkable.callStatic.isKeeper(randomKeeper.address)).to.be.false;
    });
    it('should return true if keeper is registered', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.isKeeper(randomKeeper.address)).to.be.true;
    });
    it('should initialize the gas accountance', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.viewGas()).to.be.eq(0);
      await jobWorkable.isKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.viewGas()).to.be.gt(0);
    });
  });

  describe('isMinKeeper', () => {
    it('should return false if address is not a keeper', async () => {
      expect(await jobWorkable.callStatic.isMinKeeper(randomKeeper.address, 0, 0, 0)).to.be.false;
    });
    it('should return false if keeper does not fulfill bonds', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.isMinKeeper(randomKeeper.address, toUnit(1), 0, 0)).to.be.false;
    });
    it('should return false if keeper does not fulfill earned', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.isMinKeeper(randomKeeper.address, 0, toUnit(1), 0)).to.be.false;
    });
    it('should return false if keeper does not fulfill age', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobWorkable.setVariable('firstSeen', { [randomKeeper.address]: blockTimestamp });

      expect(await jobWorkable.callStatic.isMinKeeper(randomKeeper.address, 0, 0, 1)).to.be.false;
    });
    it('should return true if keeper fulfill all the requirements', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

      await jobWorkable.setVariable('bonds', { [randomKeeper.address]: { [keep3rV1.address]: toUnit(1) } });
      await jobWorkable.setVariable('workCompleted', { [randomKeeper.address]: toUnit(1) });
      await jobWorkable.setVariable('firstSeen', { [randomKeeper.address]: blockTimestamp - 1 });

      expect(await jobWorkable.callStatic.isMinKeeper(randomKeeper.address, toUnit(1), toUnit(1), 1)).to.be.true;
    });
  });

  describe('isBondedKeeper', () => {
    it('should return false if address is not a keeper', async () => {
      expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, 0, 0)).to.be.false;
    });
    it('should return false if keeper does not fulfill bonds', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, toUnit(1), 0, 0)).to.be.false;
    });
    it('should return false if keeper does not fulfill earned', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, toUnit(1), 0)).to.be.false;
    });
    it('should return false if keeper does not fulfill age', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobWorkable.setVariable('firstSeen', { [randomKeeper.address]: blockTimestamp });

      expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, 0, 1)).to.be.false;
    });
    it('should return true if keeper fulfill all the requirements', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

      await jobWorkable.setVariable('bonds', { [randomKeeper.address]: { [randomLiquidity.address]: toUnit(1) } });
      await jobWorkable.setVariable('workCompleted', { [randomKeeper.address]: toUnit(1) });
      await jobWorkable.setVariable('firstSeen', { [randomKeeper.address]: blockTimestamp - 1 });

      expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, toUnit(1), toUnit(1), 1)).to.be.true;
    });
  });

  describe('worked', () => {
    it('should revert when called with unallowed job', async () => {
      await expect(jobWorkable.worked(randomKeeper.address)).to.be.revertedWith('JobUnapproved()');
    });

    context('when job is allowed', () => {
      let blockTimestamp: number;
      let jobCredits: BigNumber;
      let oneTenth: number;
      let oneTick: number;

      beforeEach(async () => {
        oneTenth = -23027 * rewardPeriodTime;
        oneTick = rewardPeriodTime;
        // 1.0001^-23027 => 1ETH / 10KP3R
        // 1.0001^1 => 1 tickDifference

        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobWorkable.setJob(approvedJob.address);
        await jobWorkable.setVariable('_isKP3RToken0', { [oraclePool.address]: true });
        await jobWorkable.setApprovedLiquidity(randomLiquidity.address);
        await jobWorkable.setVariable('_liquidityPool', { [randomLiquidity.address]: oraclePool.address });
        await jobWorkable.setJobLiquidity(approvedJob.address, randomLiquidity.address);
        await jobWorkable.setVariable('_initialGas', 1_500_000);

        const liquidityToAdd = toUnit(1);
        jobCredits = mathUtils.calcPeriodCredits(liquidityToAdd);
        await jobWorkable.setVariable('liquidityAmount', { [approvedJob.address]: { [randomLiquidity.address]: liquidityToAdd } });

        oraclePool.observe.returns([[oneTick], []]);
      });

      it('should update KP3R/WETH quote if needed', async () => {
        // let a period pass to outdate the current quote
        await evm.advanceTimeAndBlock(moment.duration(10, 'days').as('seconds'));
        // set oracle response
        const currentTick = oneTick;
        const previousTick = 0;
        const tickDifference = currentTick - previousTick;
        kp3rWethPool.observe.returns([[currentTick, previousTick], []]);
        // job awards no credits to keeper
        helper.getRewardBoostFor.returns([0, 1]);

        await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(kp3rWethPool.observe).to.have.been.calledOnce;
        expect(await jobWorkable.viewTickCache(kp3rWethPool.address)).to.deep.equal([
          BigNumber.from(currentTick),
          BigNumber.from(tickDifference),
          BigNumber.from(mathUtils.calcPeriod(blockTimestamp)),
        ]);
      });

      it('should update job credits if needed', async () => {
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        // job rewarded mid last period but less than a rewardPeriodTime ago
        const previousRewardedAt = blockTimestamp + 100 - rewardPeriodTime;
        await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
        await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });

        // work pays no gas to the keeper
        helper.getRewardBoostFor.returns([0, 1]);

        await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });

        // work updates jobCredits to current twap price
        expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.closeTo(
          mathUtils.increase1Tick(jobCredits),
          mathUtils.blockShiftPrecision
        );
        // work does not reward the job
        expect(await jobWorkable.rewardedAt(approvedJob.address)).to.be.eq(previousRewardedAt);
      });

      context('when credits are outdated', () => {
        beforeEach(async () => {
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
          await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
          // work pays no gas to the keeper
          helper.getRewardBoostFor.returns([0, 1]);

          // job was rewarded last period >> should be rewarded this period
          const previousRewardedAt = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        });

        it('should reward job with period credits', async () => {
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
          await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
          helper.getRewardBoostFor.returns([0, 1]);

          await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(await jobWorkable.jobPeriodCredits(approvedJob.address));
        });

        it('should emit event', async () => {
          const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          expect(tx)
            .to.emit(jobWorkable, 'JobCreditsUpdated')
            .withArgs(approvedJob.address, mathUtils.calcPeriod(blockTimestamp), await jobWorkable.jobLiquidityCredits(approvedJob.address));
        });
      });

      context('when job credits are not enough for payment', () => {
        beforeEach(async () => {
          oraclePool.observe.returns([[oneTenth], []]);
          randomLiquidity.observe.returns([[oneTenth], []]);
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          // work pays more gas than current credits
          // rewardETH = gasUsed * 120% * 20Gwei
          // rewardKP3R = rewardETH / oneTenth
          helper.getRewardBoostFor.returns([toGwei(20).mul(1.2 * 10_000), 10_000]);

          // job rewarded mid last period but less than a rewardPeriodTime ago
          const previousRewardedAt = blockTimestamp + 15 - rewardPeriodTime;
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        });

        it('should reward job', async () => {
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: toUnit(1) });
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });

          await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          // work does reward the job at current timestamp
          expect(await jobWorkable.rewardedAt(approvedJob.address)).to.be.eq(blockTimestamp);
          // work rewards job and pays the keeper
          expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.gt(0);
        });

        it('should reward job twice if credits where outdated', async () => {
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });

          const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });

          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          const jobPeriodCredits = await jobWorkable.jobPeriodCredits(approvedJob.address);

          /* Expectation: 2 event emitted
          // 1- rewarding the job with current period credits
          // 2- rewarding the job with minted credits since current period
          */
          expect(tx)
            .to.emit(jobWorkable, 'JobCreditsUpdated')
            .withArgs(approvedJob.address, mathUtils.calcPeriod(blockTimestamp), jobPeriodCredits);
          expect(tx)
            .to.emit(jobWorkable, 'JobCreditsUpdated')
            .withArgs(
              approvedJob.address,
              blockTimestamp,
              jobPeriodCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp)))
            );
        });

        it('should update payment with extra gas used by the keeper', async () => {
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: toUnit(10) });
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });
          await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          const bondsAcc1 = await jobWorkable.bonds(randomKeeper.address, keep3rV1.address);
          // second job shouldn't reward the job and earn less KP3R
          await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          const bondsAcc2 = await jobWorkable.bonds(randomKeeper.address, keep3rV1.address);

          expect(bondsAcc1).to.be.gt(bondsAcc2.sub(bondsAcc1));
        });
      });
    });
  });

  describe('bondedPayment', () => {
    it('should revert when called with unallowed job', async () => {
      await expect(jobWorkable.bondedPayment(randomKeeper.address, toUnit(1))).to.be.revertedWith('JobUnapproved()');
    });

    it('should revert when the job does not have any liquidity', async () => {
      await expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1))).to.be.revertedWith('InsufficientFunds()');
    });

    it('should revert if job is disputed', async () => {
      await jobWorkable.setVariable('disputes', {
        [approvedJob.address]: true,
      });

      await expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1))).to.be.revertedWith('JobDisputed()');
    });

    context('when job has updated liquidity credits', () => {
      let blockTimestamp: number;
      const initialJobCredits = toUnit(100);

      beforeEach(async () => {
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: initialJobCredits });
        await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });
      });

      it('should not revert', async () => {
        await expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1))).not.to.be.reverted;
      });
    });

    context('when job has added liquidity', () => {
      let blockTimestamp: number;
      const initialJobLiquidity = toUnit(100);

      beforeEach(async () => {
        await jobWorkable.setJobLiquidity(approvedJob.address, randomLiquidity.address);
        await jobWorkable.setVariable('liquidityAmount', { [approvedJob.address]: { [randomLiquidity.address]: initialJobLiquidity } });
        await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: initialJobLiquidity });

        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        await jobWorkable.setVariable('_tick', { [randomLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      });

      context('when liquidity is not approved', () => {
        it('should revert with InsufficientFunds', async () => {
          await expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1))).to.be.revertedWith('InsufficientFunds');
        });
      });

      context('when liquidity is approved', () => {
        beforeEach(async () => {
          await jobWorkable.setApprovedLiquidity(randomLiquidity.address);
        });

        it('should substract payed credits', async () => {
          await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
          const jobCredits = mathUtils.calcPeriodCredits(initialJobLiquidity);

          expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(jobCredits.sub(toUnit(1)));
        });

        it('should emit event', async () => {
          const jobCredits = mathUtils.calcPeriodCredits(initialJobLiquidity);
          const tx = await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
          const workBlock = await ethers.provider.getBlock('latest');

          expect(tx)
            .to.emit(jobWorkable, 'KeeperWork')
            .withArgs(keep3rV1.address, approvedJob.address, randomKeeper.address, workBlock.number, toUnit(1), jobCredits.sub(toUnit(1)));
        });

        it('should record keeper last job timestamp', async () => {
          await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));

          const workBlock = await ethers.provider.getBlock('latest');
          expect(await jobWorkable.lastJob(randomKeeper.address)).to.be.equal(workBlock.timestamp);
        });

        it('should record job last worked timestamp', async () => {
          await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));

          const workBlock = await ethers.provider.getBlock('latest');
          expect(await jobWorkable.workedAt(approvedJob.address)).to.be.equal(workBlock.timestamp);
        });

        context('when liquidity credits are less than payment amount', () => {
          beforeEach(async () => {
            await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: toUnit(0) });
          });

          context('when job has not minted enough credits to pay', async () => {
            beforeEach(async () => {
              jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: blockTimestamp });
            });
            it('should revert with InsufficientFunds', async () => {
              await expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1))).to.be.reverted;
            });
          });
          context('when job has minted enough credits', () => {
            beforeEach(async () => {
              blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
              await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: blockTimestamp - 0.9 * rewardPeriodTime });
            });

            it('should reward the job with pending credits and pay the keeper', async () => {
              const jobCredits = mathUtils.calcPeriodCredits(initialJobLiquidity);
              const previousJobLiquidityCredits = await jobWorkable.jobLiquidityCredits(approvedJob.address);
              // A second has passed
              await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
              blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

              expect(await jobWorkable.jobPeriodCredits(approvedJob.address)).to.be.eq(jobCredits);
              expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.gt(previousJobLiquidityCredits);
            });
            it('should update the job last rewarded timestamp', async () => {
              await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
              blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

              expect(await jobWorkable.rewardedAt(approvedJob.address)).to.be.eq(blockTimestamp);
            });
            it('should not have any pending credits', async () => {
              await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));

              expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(
                await jobWorkable.totalJobCredits(approvedJob.address)
              );
            });
          });
          context('when job has minted more than a period of credits', () => {
            beforeEach(async () => {
              await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: blockTimestamp - 1.1 * rewardPeriodTime });
            });

            it('should reward the job with a full period of credits', async () => {
              let jobPeriodCredits = await jobWorkable.jobPeriodCredits(approvedJob.address);

              await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));

              expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(jobPeriodCredits.sub(toUnit(1)));
            });
            it('should still have some pending credits', async () => {
              await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
              blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

              expect(await jobWorkable.rewardedAt(approvedJob.address)).not.to.be.eq(blockTimestamp);
              expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.lt(
                await jobWorkable.totalJobCredits(approvedJob.address)
              );
            });
          });
        });

        context('reward', () => {
          it('should increase keeper KP3R bonds', async () => {
            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
            expect(await jobWorkable.bonds(randomKeeper.address, keep3rV1.address)).to.equal(toUnit(1));
          });

          it('should increase total KP3R bonded', async () => {
            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
            expect(await jobWorkable.bonds(randomKeeper.address, keep3rV1.address)).to.equal(toUnit(1));
          });
        });
      });
    });
  });

  describe('directTokenPayment', () => {
    let token: FakeContract<ERC20>;

    beforeEach(async () => {
      token = await smock.fake(ERC20Artifact.abi);
      token.transfer.returns(true);
    });

    it('should revert when called with unallowed job', async () => {
      await expect(jobWorkable.directTokenPayment(token.address, randomKeeper.address, toUnit(1))).to.be.revertedWith('JobUnapproved()');
    });

    it('should revert when the job does not have enought credits', async () => {
      await expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1))).to.be.revertedWith(
        'InsufficientFunds()'
      );
    });

    it('should revert if job is disputed', async () => {
      await jobWorkable.setVariable('disputes', {
        [approvedJob.address]: true,
      });
      await expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1))).to.be.revertedWith(
        'JobDisputed()'
      );
    });

    context('when job has token credits', () => {
      const initialJobCredits = toUnit(5);

      beforeEach(async () => {
        await jobWorkable.setVariable('jobTokenCredits', {
          [approvedJob.address]: {
            [token.address]: initialJobCredits,
          },
        });
      });

      it('should revert if transfer fails', async () => {
        token.transfer.returns(false);
        await expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1))).to.be.revertedWith(
          'SafeERC20: ERC20 operation did not succeed'
        );
      });

      it('should substract payed credits', async () => {
        await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1));
        expect(await jobWorkable.jobTokenCredits(approvedJob.address, token.address)).to.be.equal(initialJobCredits.sub(toUnit(1)));
      });

      it('should record keeper last job timestamp', async () => {
        await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1));

        const workBlock = await ethers.provider.getBlock('latest');
        expect(await jobWorkable.lastJob(randomKeeper.address)).to.be.equal(workBlock.timestamp);
      });

      it('should transfer tokens to the keeper', async () => {
        await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1));
        expect(token.transfer).to.be.calledOnceWith(randomKeeper.address, toUnit(1));
      });

      it('should emit event', async () => {
        const workBlock = await ethers.provider.getBlock('latest');

        await expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1)))
          .to.emit(jobWorkable, 'KeeperWork')
          .withArgs(token.address, approvedJob.address, randomKeeper.address, workBlock.number + 1, toUnit(1), initialJobCredits.sub(toUnit(1)));
      });
    });
  });
});
