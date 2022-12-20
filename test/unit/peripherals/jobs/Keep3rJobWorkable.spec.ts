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
} from '@types';
import { evm } from '@utils';
import { toGwei, toUnit } from '@utils/bn';
import { readArgFromEvent, readArgsFromEvent } from '@utils/event-utils';
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

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;
  let inflationPeriodTime: number;

  let mathUtils: MathUtils;
  let snapshotId: string;

  before(async () => {
    [, randomKeeper, approvedJob] = await ethers.getSigners();

    jobWorkableFactory = await smock.mock('Keep3rJobWorkableForTest');
    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');
    randomLiquidity = await smock.fake('IUniswapV3Pool');
    oraclePool = await smock.fake('IUniswapV3Pool');
    kp3rWethPool = await smock.fake('IUniswapV3Pool');

    helper.isKP3RToken0.returns(true);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);

    jobWorkable = await jobWorkableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address);

    await jobWorkable.setJob(approvedJob.address);

    rewardPeriodTime = (await jobWorkable.rewardPeriodTime()).toNumber();
    inflationPeriodTime = (await jobWorkable.inflationPeriod()).toNumber();

    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
    const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const testPeriodTime = mathUtils.calcPeriod(blockTimestamp + rewardPeriodTime) + rewardPeriodTime / 2;
    // set the test to start mid-period
    evm.advanceToTime(testPeriodTime);
    evm.advanceBlock();

    // set kp3rWethPool to be set and updated
    await jobWorkable.setVariable('_tick', { [kp3rWethPool.address]: { period: mathUtils.calcPeriod(testPeriodTime) } });
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

    it('should emit event', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      const gasLimit = BigNumber.from(30_000_000);

      const tx = await jobWorkable.isKeeper(randomKeeper.address, { gasLimit: gasLimit.mul(63).div(64) });
      const gasUsed = (await tx.wait()).gasUsed;
      const gasRecord = await readArgFromEvent(tx, 'KeeperValidation', '_gasLeft');

      await expect(tx).to.emit(jobWorkable, 'KeeperValidation');
      expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 50000);
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

    it('should emit event', async () => {
      await jobWorkable.setKeeper(randomKeeper.address);
      const gasLimit = BigNumber.from(30_000_000);

      const tx = await jobWorkable.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, 0, 0, {
        gasLimit: gasLimit.mul(63).div(64),
      });
      const gasUsed = (await tx.wait()).gasUsed;
      const gasRecord = await readArgFromEvent(tx, 'KeeperValidation', '_gasLeft');

      await expect(tx).to.emit(jobWorkable, 'KeeperValidation');
      expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 50000);
    });
  });

  describe('worked', () => {
    it('should revert if _initialGas is 0', async () => {
      await jobWorkable.setVariable('_initialGas', 0);
      await expect(jobWorkable.worked(randomKeeper.address)).to.be.revertedWith('GasNotInitialized()');
    });

    it('should revert when called with unallowed job', async () => {
      await jobWorkable.setVariable('_initialGas', 1);
      await expect(jobWorkable.worked(randomKeeper.address)).to.be.revertedWith('JobUnapproved()');
    });

    it('should revert if job is disputed', async () => {
      await jobWorkable.setVariable('_initialGas', 1);
      await jobWorkable.setVariable('disputes', { [approvedJob.address]: true });

      await expect(jobWorkable.connect(approvedJob).worked(randomKeeper.address)).to.be.revertedWith('JobDisputed()');
    });

    context('when job is allowed', () => {
      let blockTimestamp: number;
      let jobCredits: BigNumber;
      let oneTick: number;

      beforeEach(async () => {
        oneTick = rewardPeriodTime;

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

        helper.observe.returns([oneTick, 0, true]);
      });

      it('should emit event', async () => {
        // work pays no gas to the keeper
        helper.getRewardBoostFor.returns(0);
        const gasLimit = BigNumber.from(30_000_000);
        await jobWorkable.setVariable('_initialGas', gasLimit);

        const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: gasLimit.mul(63).div(64) });
        const eventArgs = (await readArgsFromEvent(tx, 'KeeperWork'))[0];
        const gasUsed = (await tx.wait()).gasUsed;
        const gasRecord = await readArgFromEvent(tx, 'KeeperWork', '_gasLeft');

        expect(eventArgs[0]).to.eq(keep3rV1.address);
        expect(eventArgs[1]).to.eq(approvedJob.address);
        expect(eventArgs[2]).to.eq(randomKeeper.address);
        expect(eventArgs[3]).to.eq(BigNumber.from(0));
        expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 50000);
      });

      it('should update job credits if needed', async () => {
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        // job rewarded mid last period but less than a rewardPeriodTime ago
        const previousRewardedAt = blockTimestamp + 100 - rewardPeriodTime;
        await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
        await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });

        // work pays no gas to the keeper
        helper.getRewardBoostFor.returns(0);
        helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => {
          return mathUtils.increase1Tick(amount);
        });

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
          helper.getRewardBoostFor.returns(0);

          // job was rewarded last period >> should be rewarded this period
          const previousRewardedAt = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        });

        it('should reward job with period credits', async () => {
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
          await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
          helper.getRewardBoostFor.returns(0);

          await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(await jobWorkable.jobPeriodCredits(approvedJob.address));
        });

        it('should emit event', async () => {
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
          const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          await expect(tx)
            .to.emit(jobWorkable, 'LiquidityCreditsReward')
            .withArgs(
              approvedJob.address,
              mathUtils.calcPeriod(blockTimestamp),
              await jobWorkable.jobLiquidityCredits(approvedJob.address),
              await jobWorkable.jobPeriodCredits(approvedJob.address)
            );
        });
      });

      context('when job credits are not enough for payment', () => {
        const oneEthQuote = toUnit(0.1); // 1 ETH = 10 KP3R
        const extraGas = 0;

        beforeEach(async () => {
          helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => {
            return amount.div(10);
          });
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          // work pays more gas than current credits
          // rewardETH = gasUsed * 120% * 20Gwei
          // rewardKP3R = rewardETH / oneTenth
          const boost = toGwei(20).mul(1.2 * 10_000);
          helper.getPaymentParams.returns([boost, oneEthQuote, extraGas]);

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
          await evm.advanceTimeAndBlock(moment.duration(1, 'days').as('seconds'));
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });

          const biggerBoost = toGwei(200).mul(1.2 * 10_000);
          helper.getPaymentParams.returns([biggerBoost, oneEthQuote, extraGas]);
          const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });

          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          const jobPeriodCredits = await jobWorkable.jobPeriodCredits(approvedJob.address);

          /* Expectation: 2 event emitted
          // 1- rewarding the job with current period credits
          // 2- rewarding the job with minted credits since current period
          */
          await expect(tx)
            .to.emit(jobWorkable, 'LiquidityCreditsReward')
            .withArgs(approvedJob.address, mathUtils.calcPeriod(blockTimestamp), jobPeriodCredits, jobPeriodCredits);

          await expect(tx)
            .to.emit(jobWorkable, 'LiquidityCreditsReward')
            .withArgs(
              approvedJob.address,
              blockTimestamp,
              jobPeriodCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp))),
              jobPeriodCredits
            );
        });

        it('should update payment with extra gas used by the keeper', async () => {
          await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: toUnit(10) });
          await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });
          await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1_000_000 });
          const bondsAcc1 = await jobWorkable.bonds(randomKeeper.address, keep3rV1.address);

          // second job shouldn't reward the job and earn less KP3R
          await jobWorkable.setVariable('_initialGas', 1_500_000); // _initialGas is deleted after worked
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
        evm.advanceTime(moment.duration(1, 'days').as('seconds'));
        await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: initialJobCredits });
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
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

          helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => amount);
        });

        it('should substract payed credits', async () => {
          await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, toUnit(1));
          const jobCredits = mathUtils.calcPeriodCredits(initialJobLiquidity);

          expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(jobCredits.sub(toUnit(1)));
        });

        it('should emit event', async () => {
          const payment = toUnit(1);
          const gasLimit = BigNumber.from(30_000_000);

          const tx = await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, payment, { gasLimit: gasLimit.mul(63).div(64) });
          const gasUsed = (await tx.wait()).gasUsed;
          const eventArgs = (await readArgsFromEvent(tx, 'KeeperWork'))[0];
          const gasRecord = await readArgFromEvent(tx, 'KeeperWork', '_gasLeft');

          expect(eventArgs.slice(0, -1)).to.be.deep.eq([keep3rV1.address, approvedJob.address, randomKeeper.address, payment]);
          expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 3000);
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

          context('when job has not minted enough credits to pay', () => {
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

    it('should revert when the keeper is disputed', async () => {
      await jobWorkable.setVariable('disputes', {
        [randomKeeper.address]: true,
      });

      await expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1))).to.be.revertedWith(
        'Disputed()'
      );
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

      it('should transfer tokens to the keeper', async () => {
        await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, toUnit(1));
        expect(token.transfer).to.be.calledOnceWith(randomKeeper.address, toUnit(1));
      });

      it('should emit event', async () => {
        const payment = toUnit(1);
        const gasLimit = BigNumber.from(30_000_000);

        const tx = await jobWorkable
          .connect(approvedJob)
          .directTokenPayment(token.address, randomKeeper.address, payment, { gasLimit: gasLimit.mul(63).div(64) });
        const gasUsed = (await tx.wait()).gasUsed;
        const gasRecord = await readArgFromEvent(tx, 'KeeperWork', '_gasLeft');
        const eventArgs = await readArgsFromEvent(tx, 'KeeperWork');

        expect(eventArgs[0].slice(0, -1)).to.be.deep.eq([token.address, approvedJob.address, randomKeeper.address, payment]);
        expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 3000);
      });
    });
  });
});
