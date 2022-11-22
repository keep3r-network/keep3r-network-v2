import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  ERC20,
  ERC20ForTest,
  ERC20ForTest__factory,
  IKeep3rV1,
  IKeep3rV1Proxy,
  IUniswapV3Pool,
  Keep3rHelper,
  Keep3rJobFundableCreditsForTest,
  Keep3rJobFundableCreditsForTest__factory,
} from '@types';
import { evm, wallet } from '@utils';
import { onlyJobOwner } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rJobFundableCredits', () => {
  const approvedJob = wallet.generateRandomAddress();
  const randomJob = wallet.generateRandomAddress();
  let governance: SignerWithAddress;
  let provider: SignerWithAddress;
  let jobOwner: SignerWithAddress;
  let jobFundable: MockContract<Keep3rJobFundableCreditsForTest>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let helper: FakeContract<Keep3rHelper>;
  let oraclePool: FakeContract<IUniswapV3Pool>;
  let jobFundableFactory: MockContractFactory<Keep3rJobFundableCreditsForTest__factory>;

  let snapshotId: string;

  before(async () => {
    [governance, provider, jobOwner] = await ethers.getSigners();

    jobFundableFactory = await smock.mock<Keep3rJobFundableCreditsForTest__factory>('Keep3rJobFundableCreditsForTest');
    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');
    oraclePool = await smock.fake('IUniswapV3Pool');
    oraclePool.token0.returns(keep3rV1.address);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);

    jobFundable = await jobFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address);
    await jobFundable.setJob(approvedJob, jobOwner.address);
  });

  describe('addTokenCreditsToJob', () => {
    let token: ERC20ForTest;
    let erc20Factory: ERC20ForTest__factory;

    before(async () => {
      erc20Factory = (await ethers.getContractFactory('ERC20ForTest')) as ERC20ForTest__factory;
    });

    beforeEach(async () => {
      token = await erc20Factory.deploy('Sample', 'SMP', provider.address, toUnit(10));
      await token.connect(provider).approve(jobFundable.address, toUnit(10));
    });

    it('should revert when called with unallowed job', async () => {
      await expect(jobFundable.connect(provider).addTokenCreditsToJob(randomJob, token.address, toUnit(1))).to.be.revertedWith(
        'JobUnavailable()'
      );
    });

    it('should revert when when token is KP3R', async () => {
      await expect(jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, keep3rV1.address, toUnit(1))).to.be.revertedWith(
        'TokenUnallowed()'
      );
    });

    it('should revert if transfer fails', async () => {
      await expect(jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(11))).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance'
      );
    });

    it('should increase job token credits, after fees', async () => {
      await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(1));
      expect(await jobFundable.jobTokenCredits(approvedJob, token.address)).to.equal(toUnit(0.997));
    });

    it('should transfer tokens to contract', async () => {
      await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(1));
      expect(await token.balanceOf(jobFundable.address)).to.equal(toUnit(0.997));
    });

    it('should save the block timestamp of when the credits were added', async () => {
      await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(1));
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      expect(await jobFundable.jobTokenCreditsAddedAt(approvedJob, token.address)).to.equal(blockTimestamp);
    });

    it('should transfer fee in tokens to governance', async () => {
      await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(1));
      expect(await token.balanceOf(governance.address)).to.equal(toUnit(0.003));
    });

    it('should emit event', async () => {
      await expect(jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(1)))
        .to.emit(jobFundable, 'TokenCreditAddition')
        .withArgs(approvedJob, token.address, provider.address, toUnit(1));
    });

    it('should add token address to the job token list', async () => {
      await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, toUnit(1));
      expect(await jobFundable.isJobToken(approvedJob, token.address)).to.be.true;
    });
  });

  describe('withdrawTokenCreditsFromJob', () => {
    let token: FakeContract<ERC20>;

    beforeEach(async () => {
      token = await smock.fake('IERC20');
      token.transfer.returns(true);
      await jobFundable.setVariable('jobTokenCredits', {
        [approvedJob]: {
          [token.address]: toUnit(1),
        },
      });
    });

    onlyJobOwner(
      () => jobFundable,
      'withdrawTokenCreditsFromJob',
      jobOwner,
      () => [approvedJob, token.address, toUnit(1), provider.address]
    );

    it('should revert if credits were deposited in the less than 60 seconds ago', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: blockTimestamp,
        },
      });
      await evm.advanceToTime(blockTimestamp + 60);
      await expect(
        jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(1), provider.address)
      ).to.be.revertedWith('JobTokenCreditsLocked()');
    });

    it('should revert if the job is disputed', async () => {
      await jobFundable.setVariable('disputes', {
        [approvedJob]: true,
      });

      await expect(
        jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(1), provider.address)
      ).to.be.revertedWith('JobDisputed()');
    });

    it('should not revert if credits were deposited 60 seconds ago', async () => {
      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: blockTimestamp,
        },
      });
      await evm.advanceToTime(blockTimestamp + 61);
      await expect(
        jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(1), provider.address)
      ).not.to.be.revertedWith('JobTokenCreditsLocked()');
    });

    it('should revert if transfer fails', async () => {
      token.transfer.returns(false);
      await expect(
        jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(1), provider.address)
      ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
    });

    it('should revert if job does not have enough credits', async () => {
      await expect(
        jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(2), provider.address)
      ).to.be.revertedWith('InsufficientJobTokenCredits()');
    });

    it('should reduce the amount withdrawn from job balance', async () => {
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: 0,
        },
      });
      await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(0.4), provider.address);
      expect(await jobFundable.jobTokenCredits(approvedJob, token.address)).to.equal(toUnit(0.6));
    });

    it('should transfer tokens to specified receiver', async () => {
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: 0,
        },
      });
      await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(1), provider.address);
      expect(token.transfer).to.be.calledOnceWith(provider.address, toUnit(1));
    });

    it('should emit event', async () => {
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: 0,
        },
      });
      await expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(0.4), provider.address))
        .to.emit(jobFundable, 'TokenCreditWithdrawal')
        .withArgs(approvedJob, token.address, provider.address, toUnit(0.4));
    });

    it('should not remove token from the job token list when partially withdrawn', async () => {
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: 0,
        },
      });
      await jobFundable.setJobToken(approvedJob, token.address);

      await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(0.4), provider.address);
      expect(await jobFundable.isJobToken(approvedJob, token.address)).to.be.true;
    });

    it('should remove token from the job token list when fully withdrawn', async () => {
      await jobFundable.setVariable('jobTokenCreditsAddedAt', {
        [approvedJob]: {
          [token.address]: 0,
        },
      });
      await jobFundable.setJobToken(approvedJob, token.address);

      await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, toUnit(1), provider.address);
      expect(await jobFundable.isJobToken(approvedJob, token.address)).to.be.false;
    });
  });
});
