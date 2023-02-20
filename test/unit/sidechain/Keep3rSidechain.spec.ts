import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IERC20,
  IUniswapV3Pool,
  JobForTest,
  Keep3rEscrow,
  Keep3rHelperSidechain,
  Keep3rSidechainForTest,
  Keep3rSidechainForTest__factory,
} from '@types';
import { bn, contracts, evm, wallet } from '@utils';
import { onlyGovernor } from '@utils/behaviours';
import { ZERO_ADDRESS } from '@utils/constants';
import { readArgFromEvent, readArgsFromEvent } from '@utils/event-utils';
import { MathUtils, mathUtilsFactory } from '@utils/math';
import chai, { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rSidechain', () => {
  let governor: SignerWithAddress;
  let randomKeeper: SignerWithAddress;
  let keep3r: MockContract<Keep3rSidechainForTest>;
  let keep3rFactory: MockContractFactory<Keep3rSidechainForTest__factory>;

  let helper: FakeContract<Keep3rHelperSidechain>;
  let erc20: FakeContract<IERC20>;
  let wKP3R: FakeContract<IERC20>;
  let escrow: FakeContract<Keep3rEscrow>;
  let oraclePool: FakeContract<IUniswapV3Pool>;
  let approvedJob: FakeContract<JobForTest>;
  let unapprovedJob: FakeContract<JobForTest>;

  let rewardPeriodTime: number;
  let mathUtils: MathUtils;

  const DAY = 86400;

  before(async () => {
    [, governor, randomKeeper] = await ethers.getSigners();
    keep3rFactory = await smock.mock('Keep3rSidechainForTest');

    helper = await smock.fake('Keep3rHelperSidechain');
    escrow = await smock.fake('Keep3rEscrow');
    erc20 = await smock.fake('IERC20');
    wKP3R = await smock.fake('IERC20');
    oraclePool = await smock.fake('IUniswapV3Pool');
    approvedJob = await smock.fake('JobForTest');
    unapprovedJob = await smock.fake('JobForTest');

    contracts.setBalance(approvedJob.address, bn.toUnit(10));
    contracts.setBalance(unapprovedJob.address, bn.toUnit(10));
  });

  beforeEach(async () => {
    keep3r = await keep3rFactory.deploy(governor.address, helper.address, wKP3R.address, escrow.address);

    rewardPeriodTime = (await keep3r.rewardPeriodTime()).toNumber();
    const inflationPeriodTime = (await keep3r.inflationPeriod()).toNumber();
    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
  });

  describe('approveLiquidity', () => {
    const liquidity = wallet.generateRandomAddress();
    const oraclePool = wallet.generateRandomAddress();

    beforeEach(async () => {
      helper.isKP3RToken0.reset();
      helper.oracle.reset();
      helper.oracle.returns(oraclePool);
    });

    onlyGovernor(
      () => keep3r,
      'approveLiquidity',
      () => governor,
      [liquidity]
    );

    it('should add the liquidity to approved liquidities list', async () => {
      await keep3r.connect(governor).approveLiquidity(liquidity);
      expect(await keep3r.approvedLiquidities()).to.contain(liquidity);
    });

    it('should revert when liquidity already approved', async () => {
      await keep3r.connect(governor).approveLiquidity(liquidity);
      await expect(keep3r.connect(governor).approveLiquidity(liquidity)).to.be.revertedWith('LiquidityPairApproved()');
    });

    it('should query keep3r helper for the correspondant oracle pool', async () => {
      await keep3r.connect(governor).approveLiquidity(liquidity);

      expect(helper.oracle).to.have.been.calledOnceWith(liquidity);
    });

    it('should revert if helper has no oracle for liquidity', async () => {
      helper.oracle.returns(ZERO_ADDRESS);
      await expect(keep3r.connect(governor).approveLiquidity(liquidity)).to.be.revertedWith('ZeroAddress');
    });

    it('should store the correspondant oracle pool', async () => {
      await keep3r.connect(governor).approveLiquidity(liquidity);

      expect(await keep3r.getVariable('_liquidityPool', [liquidity])).to.eq(oraclePool);
    });

    it('should query keep3r helper for the token order', async () => {
      await keep3r.connect(governor).approveLiquidity(liquidity);

      expect(helper.isKP3RToken0).to.have.been.calledOnceWith(oraclePool);
    });

    it('should sort the tokens in the liquidity pair', async () => {
      helper.isKP3RToken0.returns(true);
      await keep3r.connect(governor).approveLiquidity(liquidity);

      expect(await keep3r.getVariable('_isKP3RToken0', [liquidity])).to.eq(true);
    });

    it('should initialize twap for liquidity', async () => {
      await keep3r.connect(governor).approveLiquidity(liquidity);
      expect(helper.observe).to.have.been.called;
    });

    it('should emit event', async () => {
      await expect(keep3r.connect(governor).approveLiquidity(liquidity)).to.emit(keep3r, 'LiquidityApproval').withArgs(liquidity);
    });
  });

  describe('observeLiquidity', () => {
    const liquidity = wallet.generateRandomAddress();
    let blockTimestamp: number;

    beforeEach(async () => {
      helper.observe.reset();
      const liquidityParams = {
        current: 0,
        difference: 0,
      };
      await keep3r.setVariable('_tick', { [liquidity]: liquidityParams });
      blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    });

    context('when liquidity is updated', () => {
      let period: number;
      beforeEach(async () => {
        period = mathUtils.calcPeriod(blockTimestamp);
        await keep3r.setVariable('_tick', { [liquidity]: { period: period } });
      });

      it('should return current tick', async () => {
        const observation = await keep3r.observeLiquidity(liquidity);

        expect(observation.current).to.eq(0);
        expect(observation.difference).to.eq(0);
        expect(observation.period).to.eq(period);
      });

      it('should not call the oracle', async () => {
        await keep3r.observeLiquidity(liquidity);
        expect(helper.observe).not.to.be.called;
      });
    });

    context('when liquidity is expired', () => {
      beforeEach(async () => {
        helper.observe.returns([2, 1, true]);
      });
      it('should return oracle tick and difference', async () => {
        const observation = await keep3r.observeLiquidity(liquidity);

        expect(observation.current).to.eq(2);
        expect(observation.difference).to.eq(1);
        expect(observation.period).to.eq(mathUtils.calcPeriod(blockTimestamp));
      });

      it('should call the oracle', async () => {
        await keep3r.setVariable('_liquidityPool', { [liquidity]: oraclePool.address });

        await keep3r.observeLiquidity(liquidity);
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        expect(helper.observe).to.have.be.calledWith(oraclePool.address, [
          blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
          blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
        ]);
      });
    });
  });

  describe('worked', () => {
    const keeper = wallet.generateRandomAddress();

    beforeEach(async () => {
      await keep3r.addJob(approvedJob.address);
      await keep3r.setVariable('_initialGas', 30e6);
    });

    it('should revert if _initialGas is 0', async () => {
      await keep3r.setVariable('_initialGas', 0);
      await expect(keep3r['worked(address,uint256)'](randomKeeper.address, 1)).to.be.revertedWith('GasNotInitialized()');
    });

    it('should revert if called only with an address', async () => {
      await expect(keep3r.connect(approvedJob.wallet)['worked(address)'](keeper)).to.be.revertedWith('Deprecated()');
    });

    it('should revert when called with unallowed job', async () => {
      await expect(keep3r.connect(unapprovedJob.wallet)['worked(address,uint256)'](keeper, 0)).to.be.revertedWith('JobUnapproved()');
    });

    it('should revert if job is disputed', async () => {
      await keep3r.setVariable('disputes', {
        [approvedJob.address]: true,
      });

      await expect(keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 0)).to.be.revertedWith('JobDisputed()');
    });

    context('when job is allowed', () => {
      const liquidity = wallet.generateRandomAddress();
      let blockTimestamp: number;
      let jobCredits: BigNumber;
      let oneTick: number;

      beforeEach(async () => {
        const liquidityToAdd = bn.toUnit(1);
        oneTick = rewardPeriodTime;

        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        helper.oracle.whenCalledWith(liquidity).returns(oraclePool.address);
        await keep3r.connect(governor).approveLiquidity(liquidity);

        await keep3r.setVariables({
          _isKP3RToken0: { [oraclePool.address]: true },
          _liquidityPool: { [liquidity]: oraclePool.address },
          liquidityAmount: { [approvedJob.address]: { [liquidity]: liquidityToAdd } },
          _initialGas: 30e6,
        });

        await keep3r.setJobLiquidity(approvedJob.address, liquidity);

        jobCredits = mathUtils.calcPeriodCredits(liquidityToAdd);
        helper.observe.returns([oneTick, 0, true]);
      });

      it('should call helper for payment parameters', async () => {
        await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 0);

        expect(helper.getPaymentParams).to.have.been.called;
      });

      it('should emit event', async () => {
        // work pays no gas to the keeper
        helper.getRewardBoostFor.returns(0);
        const gasLimit = BigNumber.from(30_000_000);
        await keep3r.setVariable('_initialGas', gasLimit);

        const tx = await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 0, { gasLimit: gasLimit.mul(63).div(64) });
        const eventArgs = (await readArgsFromEvent(tx, 'KeeperWork'))[0];
        const gasUsed = (await tx.wait()).gasUsed;
        const gasRecord = await readArgFromEvent(tx, 'KeeperWork', '_gasLeft');

        expect(eventArgs[0]).to.eq(wKP3R.address);
        expect(eventArgs[1]).to.eq(approvedJob.address);
        expect(eventArgs[2]).to.eq(keeper);
        expect(eventArgs[3]).to.eq(BigNumber.from(0));
        // gasRecord doesn't include keep3r actions
        expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 400_000);
      });

      it('should update job credits if needed', async () => {
        blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
        // job rewarded mid last period but less than a rewardPeriodTime ago
        const previousRewardedAt = blockTimestamp + 100 - rewardPeriodTime;
        await keep3r.setVariables({
          rewardedAt: { [approvedJob.address]: previousRewardedAt },
          _jobLiquidityCredits: { [approvedJob.address]: jobCredits },
          _jobPeriodCredits: { [approvedJob.address]: jobCredits },
        });

        // work pays no gas to the keeper
        helper.getRewardBoostFor.returns(0);
        helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => {
          return mathUtils.increase1Tick(amount);
        });

        await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 0, { gasLimit: 1_000_000 });

        // work updates jobCredits to current twap price
        expect(await keep3r.jobLiquidityCredits(approvedJob.address)).to.be.closeTo(
          mathUtils.increase1Tick(jobCredits),
          mathUtils.blockShiftPrecision
        );
        // work does not reward the job
        expect(await keep3r.rewardedAt(approvedJob.address)).to.be.eq(previousRewardedAt);
      });

      context('when credits are outdated', () => {
        beforeEach(async () => {
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          await keep3r.setVariables({
            _jobPeriodCredits: { [approvedJob.address]: jobCredits },
            _jobLiquidityCredits: { [approvedJob.address]: jobCredits },
          });
          // work pays no gas to the keeper
          helper.getRewardBoostFor.returns(0);

          // job was rewarded last period >> should be rewarded this period
          const previousRewardedAt = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
          await keep3r.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        });

        it('should reward job with period credits', async () => {
          await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 0, { gasLimit: 1_000_000 });
          expect(await keep3r.jobLiquidityCredits(approvedJob.address)).to.be.eq(await keep3r.jobPeriodCredits(approvedJob.address));
        });

        it('should emit event', async () => {
          await keep3r.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
          const tx = await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 0, { gasLimit: 1_000_000 });
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          await expect(tx)
            .to.emit(keep3r, 'LiquidityCreditsReward')
            .withArgs(
              approvedJob.address,
              mathUtils.calcPeriod(blockTimestamp),
              await keep3r.jobLiquidityCredits(approvedJob.address),
              await keep3r.jobPeriodCredits(approvedJob.address)
            );
        });
      });

      context('when job credits are not enough for payment', () => {
        beforeEach(async () => {
          helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => {
            return amount.div(10);
          });

          // work pays more gas than current credits
          const boost = 1.2 * 10_000;

          helper.getPaymentParams.returns([boost, bn.toUnit(100), 0]);

          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          // job rewarded mid last period but less than a rewardPeriodTime ago
          const previousRewardedAt = blockTimestamp + 15 - rewardPeriodTime;
          await keep3r.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
        });

        it('should reward job', async () => {
          await keep3r.setVariables({
            _jobPeriodCredits: { [approvedJob.address]: bn.toUnit(1) },
            rewardedAt: { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) },
          });

          await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 1, { gasLimit: 1_000_000 });
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

          // work does reward the job at current timestamp
          expect(await keep3r.rewardedAt(approvedJob.address)).to.be.eq(blockTimestamp);
          // work rewards job and pays the keeper
          expect(await keep3r.jobLiquidityCredits(approvedJob.address)).to.be.gt(0);
        });

        it('should reward job twice if credits where outdated', async () => {
          await evm.advanceTimeAndBlock(DAY);
          await keep3r.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });

          const currentLiquidityCredits = await keep3r.jobLiquidityCredits(approvedJob.address);

          const tx = await keep3r.connect(approvedJob.wallet).bondedPayment(keeper, currentLiquidityCredits.add(1));
          blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
          const jobPeriodCredits = await keep3r.jobPeriodCredits(approvedJob.address);

          /* Expectation: 2 event emitted
          // 1- rewarding the job with current period credits
          // 2- rewarding the job with minted credits since current period
          */
          await expect(tx)
            .to.emit(keep3r, 'LiquidityCreditsReward')
            .withArgs(approvedJob.address, mathUtils.calcPeriod(blockTimestamp), jobPeriodCredits, jobPeriodCredits);

          await expect(tx)
            .to.emit(keep3r, 'LiquidityCreditsReward')
            .withArgs(
              approvedJob.address,
              blockTimestamp,
              jobPeriodCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp))),
              jobPeriodCredits
            );
        });

        it('should not pay extra gas used by keep3r internal functions', async () => {
          await keep3r.setVariables({
            _jobPeriodCredits: { [approvedJob.address]: bn.toUnit(10) },
            rewardedAt: { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) },
          });

          const tx1 = await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 1_000_000, { gasLimit: 1_000_000 });
          const bondsAcc1 = await keep3r.bonds(keeper, wKP3R.address);
          const gasUsed1 = (await tx1.wait()).gasUsed;

          // second job shouldn't reward the job and earn less KP3R
          await keep3r.setVariable('_initialGas', 30e6); // _initialGas is deleted after worked
          const tx2 = await keep3r.connect(approvedJob.wallet)['worked(address,uint256)'](keeper, 1_000_000, { gasLimit: 1_000_000 });
          const bondsAcc2 = await keep3r.bonds(keeper, wKP3R.address);
          const gasUsed2 = (await tx2.wait()).gasUsed;

          expect(gasUsed1).to.be.gt(gasUsed2);
          expect(bondsAcc1).to.be.eq(bondsAcc2.sub(bondsAcc1));
        });
      });
    });
  });

  describe('activate', () => {
    const BONDS = bn.toUnit(1);
    context('when activating any ERC20', () => {
      beforeEach(async () => {
        const lastBlock = await ethers.provider.getBlock('latest');

        await keep3r.setVariables({
          canActivateAfter: { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } },
          pendingBonds: { [randomKeeper.address]: { [erc20.address]: BONDS } },
        });
      });

      it('should add the keeper', async () => {
        await keep3r.connect(randomKeeper).activate(erc20.address);
        expect(await keep3r.callStatic.isKeeper(randomKeeper.address)).to.be.true;
      });

      it('should reset pending bonds for that token', async () => {
        expect(await keep3r.pendingBonds(randomKeeper.address, erc20.address)).to.be.eq(BONDS);
        await keep3r.connect(randomKeeper).activate(erc20.address);
        expect(await keep3r.pendingBonds(randomKeeper.address, erc20.address)).to.be.eq(0);
      });

      it('should add pending bonds to keeper accountance', async () => {
        expect(await keep3r.bonds(randomKeeper.address, erc20.address)).to.be.eq(0);
        await keep3r.connect(randomKeeper).activate(erc20.address);
        expect(await keep3r.bonds(randomKeeper.address, erc20.address)).to.be.eq(BONDS);
      });

      it('should emit event', async () => {
        const tx = await keep3r.connect(randomKeeper).activate(erc20.address);

        await expect(tx).to.emit(keep3r, 'Activation').withArgs(randomKeeper.address, erc20.address, BONDS);
      });
    });

    context('when activating wKP3R', () => {
      beforeEach(async () => {
        const lastBlock = await ethers.provider.getBlock('latest');
        await keep3r.setVariables({
          canActivateAfter: { [randomKeeper.address]: { [wKP3R.address]: lastBlock.timestamp } },
          pendingBonds: { [randomKeeper.address]: { [wKP3R.address]: BONDS } },
        });
      });

      it('should create an allowance in wKP3R', async () => {
        await keep3r.connect(randomKeeper).activate(wKP3R.address);
        expect(wKP3R.approve).to.have.been.calledWith(escrow.address, BONDS);
      });

      it('should deposit in escrow wKP3Rs', async () => {
        await keep3r.connect(randomKeeper).activate(wKP3R.address);
        expect(escrow.deposit).to.have.been.calledWith(BONDS);
      });
    });
  });

  describe('virtualReserves', () => {
    const ESCROW_AMOUNT = bn.toUnit(100);
    const BONDS_AMOUNT = bn.toUnit(10);

    beforeEach(async () => {
      wKP3R.balanceOf.reset();
      wKP3R.balanceOf.whenCalledWith(escrow.address).returns(ESCROW_AMOUNT);
      keep3r.setVariable('totalBonds', BONDS_AMOUNT);
    });

    it('should query wKP3R balance of escrow contract', async () => {
      await keep3r.virtualReserves();
      expect(wKP3R.balanceOf).to.have.been.calledWith(escrow.address);
    });

    it('should return the substraction result', async () => {
      expect(await keep3r.virtualReserves()).to.eq(ESCROW_AMOUNT.sub(BONDS_AMOUNT));
    });

    it('should support negative reserves', async () => {
      keep3r.setVariable('totalBonds', ESCROW_AMOUNT.add(1));

      expect(await keep3r.virtualReserves()).to.eq(-1);
    });
  });
});
