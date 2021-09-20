import IUniswapV3PoolArtifact from '@contracts/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import IKeep3rV1Artifact from '@contracts/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rV1ProxyArtifact from '@contracts/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import IKeep3rHelperArtifact from '@contracts/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json';
import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { ContractTransaction } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rJobMigrationForTest, Keep3rJobMigrationForTest__factory, Keep3rLibrary } from '@types';
import { evm, wallet } from '@utils';
import { onlyJobOwner } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import { ZERO_ADDRESS } from '@utils/constants';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import moment from 'moment';

describe('Keep3rJobMigration', () => {
  const fromJob = wallet.generateRandomAddress();
  const toJob = wallet.generateRandomAddress();
  let fromJobOwner: SignerWithAddress;
  let toJobOwner: SignerWithAddress;
  let jobMigration: MockContract<Keep3rJobMigrationForTest>;
  let jobMigrationFactory: MockContractFactory<Keep3rJobMigrationForTest__factory>;

  before(async () => {
    [, fromJobOwner, toJobOwner] = await ethers.getSigners();
    const library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as Keep3rLibrary;
    jobMigrationFactory = await smock.mock<Keep3rJobMigrationForTest__factory>('Keep3rJobMigrationForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
  });

  beforeEach(async () => {
    const helper = await smock.fake(IKeep3rHelperArtifact);
    const keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    const keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    const oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token0.returns(keep3rV1.address);
    oraclePool.observe.returns([[0, 0], []]);

    jobMigration = await jobMigrationFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
    await jobMigration.setVariable('jobOwner', {
      [fromJob]: fromJobOwner.address,
    });

    await jobMigration.setVariable('jobOwner', {
      [toJob]: toJobOwner.address,
    });
  });

  describe('migrateJob', () => {
    onlyJobOwner(() => jobMigration, 'migrateJob', fromJobOwner, [fromJob, toJob]);

    it('should revert if migration targets the same job', async () => {
      await expect(jobMigration.connect(fromJobOwner).migrateJob(fromJob, fromJob)).to.be.revertedWith('JobMigrationImpossible()');
    });

    it('should create a job migration request', async () => {
      await jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob);
      expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(toJob);
    });

    it('should overwrite previous migration request', async () => {
      await jobMigration.connect(fromJobOwner).migrateJob(fromJob, wallet.generateRandomAddress());
      await jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob);
      expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(toJob);
    });

    it('should emit event', async () => {
      await expect(jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob))
        .to.emit(jobMigration, 'JobMigrationRequested')
        .withArgs(fromJob, toJob);
    });

    context('when sending zero address', async () => {
      it('should cancel migration', async () => {
        await jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob);
        await jobMigration.connect(fromJobOwner).migrateJob(fromJob, ZERO_ADDRESS);
        expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(ZERO_ADDRESS);
      });

      it('should emit event', async () => {
        await expect(jobMigration.connect(fromJobOwner).migrateJob(fromJob, ZERO_ADDRESS))
          .to.emit(jobMigration, 'JobMigrationRequested')
          .withArgs(fromJob, ZERO_ADDRESS);
      });
    });
  });

  describe('acceptJobMigration', () => {
    const tokenA = wallet.generateRandomAddress();
    const tokenB = wallet.generateRandomAddress();
    const tokenC = wallet.generateRandomAddress();
    const liquidityA = wallet.generateRandomAddress();
    const liquidityB = wallet.generateRandomAddress();
    const liquidityC = wallet.generateRandomAddress();
    const fromJobTokenAAmount = toUnit(1);
    const fromJobTokenBAmount = toUnit(2);
    const toJobTokenBAmount = toUnit(3);
    const toJobTokenCAmount = toUnit(4);
    const fromJobLiquidityAAmount = toUnit(1);
    const fromJobLiquidityBAmount = toUnit(2);
    const toJobLiquidityBAmount = toUnit(3);
    const toJobLiquidityCAmount = toUnit(4);
    const fromJobPeriodCredits = toUnit(1);
    const toJobPeriodCredits = toUnit(2);
    const fromJobLiquidityCredits = toUnit(3);
    const toJobLiquidityCredits = toUnit(4);

    beforeEach(async () => {
      await jobMigration.setJobToken(fromJob, tokenA);
      await jobMigration.setJobToken(fromJob, tokenB);
      await jobMigration.setJobToken(toJob, tokenB);
      await jobMigration.setJobToken(toJob, tokenC);

      await jobMigration.setVariable('jobTokenCredits', {
        [fromJob]: {
          [tokenA]: fromJobTokenAAmount,
          [tokenB]: fromJobTokenBAmount,
        },
        [toJob]: {
          [tokenB]: toJobTokenBAmount,
          [tokenC]: toJobTokenCAmount,
        },
      });

      await jobMigration.setVariable('pendingJobMigrations', {
        [fromJob]: toJob,
      });

      await jobMigration.setVariable('_migrationCreatedAt', {
        [fromJob]: { [toJob]: (await ethers.provider.getBlock('latest')).timestamp },
      });

      await jobMigration.setJobLiquidity(fromJob, liquidityA);
      await jobMigration.setJobLiquidity(fromJob, liquidityB);
      await jobMigration.setJobLiquidity(toJob, liquidityB);
      await jobMigration.setJobLiquidity(toJob, liquidityC);
      await jobMigration.setVariable('liquidityAmount', {
        [fromJob]: {
          [liquidityA]: fromJobLiquidityAAmount,
          [liquidityB]: fromJobLiquidityBAmount,
        },
        [toJob]: {
          [liquidityB]: toJobLiquidityBAmount,
          [liquidityC]: toJobLiquidityCAmount,
        },
      });

      await jobMigration.setVariable('_jobPeriodCredits', {
        [fromJob]: fromJobPeriodCredits,
        [toJob]: toJobPeriodCredits,
      });

      await jobMigration.setVariable('_jobLiquidityCredits', {
        [fromJob]: fromJobLiquidityCredits,
        [toJob]: toJobLiquidityCredits,
      });
    });

    onlyJobOwner(() => jobMigration, 'acceptJobMigration', toJobOwner, [fromJob, toJob]);

    it('should revert if requested migration does not exist', async () => {
      await expect(jobMigration.connect(fromJobOwner).acceptJobMigration(toJob, fromJob)).to.be.revertedWith('JobMigrationUnavailable()');
    });

    it('should revert if fromJob is disputed', async () => {
      await jobMigration.setVariable('disputes', { [fromJob]: true });
      await expect(jobMigration.connect(fromJobOwner).acceptJobMigration(toJob, fromJob)).to.be.revertedWith('JobDisputed()');
    });

    it('should revert if toJob is disputed', async () => {
      await jobMigration.setVariable('disputes', { [toJob]: true });
      await expect(jobMigration.connect(fromJobOwner).acceptJobMigration(toJob, fromJob)).to.be.revertedWith('JobDisputed()');
    });

    it('should revert if cooldown period did not end', async () => {
      await expect(jobMigration.connect(toJobOwner).acceptJobMigration(fromJob, toJob)).to.be.revertedWith('JobMigrationLocked()');
    });

    context('when accepting the migration after the cooldown period', () => {
      let tx: ContractTransaction;

      beforeEach(async () => {
        await evm.advanceTimeAndBlock(moment.duration(1, 'minute').as('seconds'));
        tx = await jobMigration.connect(toJobOwner).acceptJobMigration(fromJob, toJob);
      });

      it('should settle fromJob accountance', async () => {
        expect(await jobMigration.settleJobAccountanceCallCount(fromJob)).to.equal(1);
      });

      it('should settle toJob accountance', async () => {
        expect(await jobMigration.settleJobAccountanceCallCount(toJob)).to.equal(1);
      });

      it('should empty original job token credits', async () => {
        expect(await jobMigration.jobTokenCredits(fromJob, tokenA)).to.equal(0);
        expect(await jobMigration.jobTokenCredits(fromJob, tokenB)).to.equal(0);
        expect(await jobMigration.jobTokenCredits(fromJob, tokenC)).to.equal(0);
        expect(await jobMigration.getJobTokenListLength(fromJob)).to.equal(0);
      });

      it('should add all token credits to the target job', async () => {
        expect(await jobMigration.jobTokenCredits(toJob, tokenA)).to.equal(fromJobTokenAAmount);
        expect(await jobMigration.jobTokenCredits(toJob, tokenB)).to.equal(fromJobTokenBAmount.add(toJobTokenBAmount));
        expect(await jobMigration.jobTokenCredits(toJob, tokenC)).to.equal(toJobTokenCAmount);
        expect(await jobMigration.getJobTokenListLength(toJob)).to.equal(3);
      });

      it('should remove the job migration request', async () => {
        expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(ZERO_ADDRESS);
      });

      it('should add liquidity amounts from fromJob to toJob', async () => {
        expect(await jobMigration.liquidityAmount(toJob, liquidityA)).to.equal(fromJobLiquidityAAmount);
        expect(await jobMigration.liquidityAmount(toJob, liquidityB)).to.equal(fromJobLiquidityBAmount.add(toJobLiquidityBAmount));
        expect(await jobMigration.liquidityAmount(toJob, liquidityC)).to.equal(toJobLiquidityCAmount);
      });

      it('should reset fromJob liquidity amounts', async () => {
        expect(await jobMigration.liquidityAmount(fromJob, liquidityA)).to.equal(0);
        expect(await jobMigration.liquidityAmount(fromJob, liquidityB)).to.equal(0);
      });

      it('should empty liquidy list from fromJob', async () => {
        expect(await jobMigration.getJobLiquidityList(fromJob)).to.deep.equal([]);
      });

      it('should fill liquidity list from toJob', async () => {
        expect(await jobMigration.getJobLiquidityList(toJob)).to.deep.equal([liquidityB, liquidityC, liquidityA]);
      });

      it('should add fromJob period credits to toJob', async () => {
        expect(await jobMigration.getJobPeriodCredits(toJob)).to.equal(fromJobPeriodCredits.add(toJobPeriodCredits));
      });

      it('should reset fromJob period credits', async () => {
        expect(await jobMigration.jobPeriodCredits(fromJob)).to.equal(0);
      });

      it('should add fromJob liquidity credits to toJob', async () => {
        expect(await jobMigration.getJobLiquidityCredits(toJob)).to.equal(fromJobLiquidityCredits.add(toJobLiquidityCredits));
      });

      it('should reset fromJob liquidity credits', async () => {
        expect(await jobMigration.getJobLiquidityCredits(fromJob)).to.equal(0);
      });

      it('should reset fromJob rewardedAt', async () => {
        expect(await jobMigration.rewardedAt(fromJob)).to.equal(0);
      });

      it('should stop fromJob from being a job', async () => {
        expect(await jobMigration.isJob(fromJob)).to.be.false;
      });

      it('should emit event', async () => {
        await expect(tx).to.emit(jobMigration, 'JobMigrationSuccessful').withArgs(fromJob, toJob);
      });
    });
  });
});
