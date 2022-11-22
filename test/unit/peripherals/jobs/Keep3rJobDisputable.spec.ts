import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import ERC20Artifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import {
  ERC20,
  IKeep3rV1,
  IKeep3rV1Proxy,
  Keep3rHelper,
  Keep3rJobDisputableForTest,
  Keep3rJobDisputableForTest__factory,
  UniV3PairManager,
} from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { MathUtils, mathUtilsFactory } from '@utils/math';
import chai, { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rJobDisputable', () => {
  const job = wallet.generateRandomAddress();
  let governance: SignerWithAddress;
  let slasher: SignerWithAddress;
  let disputer: SignerWithAddress;
  let jobDisputable: MockContract<Keep3rJobDisputableForTest>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let helper: FakeContract<Keep3rHelper>;
  let jobDisputableFactory: MockContractFactory<Keep3rJobDisputableForTest__factory>;
  let liquidityA: FakeContract<UniV3PairManager>;
  let liquidityB: FakeContract<UniV3PairManager>;

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;
  let inflationPeriodTime: number;

  let mathUtils: MathUtils;
  let snapshotId: string;

  before(async () => {
    [governance, slasher, disputer] = await ethers.getSigners();

    jobDisputableFactory = await smock.mock('Keep3rJobDisputableForTest');
    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');

    helper.isKP3RToken0.returns(true);
    helper.observe.returns([0, 0, true]);
    helper.getKP3RsAtTick.returns(([amount]: [BigNumber]) => amount);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
    jobDisputable = await jobDisputableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address);

    await jobDisputable.setVariable('slashers', { [slasher.address]: true });
    await jobDisputable.setVariable('disputers', { [disputer.address]: true });
    await jobDisputable.setVariable('disputes', { [job]: true });

    rewardPeriodTime = (await jobDisputable.rewardPeriodTime()).toNumber();
    inflationPeriodTime = (await jobDisputable.inflationPeriod()).toNumber();

    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
  });

  describe('slashTokenFromJob', () => {
    let tokenA: FakeContract<ERC20>;
    let tokenB: FakeContract<ERC20>;
    let tx: ContractTransaction;
    let initialTokenA = toUnit(1);
    let initialTokenB = toUnit(2);
    let tokenAToRemove = toUnit(0.9);

    beforeEach(async () => {
      // setup tokens
      tokenA = await smock.fake<ERC20>(ERC20Artifact);
      tokenB = await smock.fake<ERC20>(ERC20Artifact);
      tokenA.transfer.returns(true);
      tokenB.transfer.returns(true);
      await jobDisputable.setJobToken(job, tokenA.address);
      await jobDisputable.setJobToken(job, tokenB.address);
      await jobDisputable.setVariable('jobTokenCredits', {
        [job]: {
          [tokenA.address]: initialTokenA,
          [tokenB.address]: initialTokenB,
        },
      });
    });

    it('should fail to slash unexistent token', async () => {
      await expect(jobDisputable.connect(slasher).slashTokenFromJob(job, wallet.generateRandomAddress(), 1)).to.be.revertedWith(
        'JobTokenUnexistent()'
      );
    });

    it('should fail to slash more than balance', async () => {
      await expect(jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA.add(1))).to.be.revertedWith(
        'JobTokenInsufficient()'
      );
    });

    it('should revert if job is not disputed', async () => {
      await jobDisputable.setVariable('disputes', {
        [job]: false,
      });
      await expect(jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA)).to.be.revertedWith('NotDisputed()');
    });

    it('should remove token from list if there is no remaining', async () => {
      await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA);
      expect(await jobDisputable.internalJobTokens(job)).to.deep.equal([tokenB.address]);
    });

    context('when partially slashing a token', () => {
      beforeEach(async () => {
        tokenA.transfer.returns(true);
        tx = await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, tokenAToRemove);
      });

      it('should transfer the tokens to governance', async () => {
        expect(tokenA.transfer).to.be.calledOnceWith(governance.address, tokenAToRemove);
      });

      it('should reduce the specified amount from token credits', async () => {
        expect(await jobDisputable.jobTokenCredits(job, tokenA.address)).to.equal(initialTokenA.sub(tokenAToRemove));
      });

      it('should not remove liquidity from list if there is some remaining', async () => {
        expect(await jobDisputable.internalJobTokens(job)).to.deep.equal([tokenA.address, tokenB.address]);
      });

      it('should not affect other liquidity balance', async () => {
        expect(await jobDisputable.jobTokenCredits(job, tokenB.address)).to.equal(initialTokenB);
      });

      it('should emit event', async () => {
        await expect(tx).to.emit(jobDisputable, 'JobSlashToken').withArgs(job, tokenA.address, slasher.address, tokenAToRemove);
      });
    });

    context('when some transfer fails', () => {
      beforeEach(async () => {
        tokenA.transfer.reverts();
      });

      it('should not revert', async () => {
        await expect(jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA)).not.to.be.reverted;
      });

      it('should call the transfer function', async () => {
        await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA);

        expect(tokenA.transfer).to.be.calledOnceWith(governance.address, initialTokenA);
      });

      it('should slash the token', async () => {
        await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA);

        expect(await jobDisputable.jobTokenCredits(job, tokenA.address)).to.equal(initialTokenA.sub(initialTokenA));
      });
    });
  });

  describe('slashLiquidityFromJob', () => {
    let tx: ContractTransaction;
    let initialLiquidityA: BigNumber;
    let initialLiquidityB: BigNumber;
    let initialLiquidityCredits = toUnit(1);
    let liquidityAToRemove = toUnit(0.3);

    beforeEach(async () => {
      initialLiquidityA = mathUtils.calcLiquidityToAdd(toUnit(1));
      initialLiquidityB = mathUtils.calcLiquidityToAdd(toUnit(2));

      // setup liquidity
      liquidityA = await smock.fake<UniV3PairManager>('UniV3PairManager');
      liquidityB = await smock.fake<UniV3PairManager>('UniV3PairManager');

      await jobDisputable.setApprovedLiquidity(liquidityA.address);
      await jobDisputable.setApprovedLiquidity(liquidityB.address);

      await jobDisputable.setJobLiquidity(job, liquidityA.address);
      await jobDisputable.setJobLiquidity(job, liquidityB.address);
      await jobDisputable.setVariable('liquidityAmount', {
        [job]: {
          [liquidityA.address]: initialLiquidityA,
          [liquidityB.address]: initialLiquidityB,
        },
      });

      // setup credits
      await jobDisputable.setVariable('_jobLiquidityCredits', { [job]: initialLiquidityCredits });
      await jobDisputable.setVariable('_jobPeriodCredits', { [job]: initialLiquidityA.add(initialLiquidityB) });

      const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      await jobDisputable.setVariable('rewardedAt', { [job]: blockTimestamp });

      await jobDisputable.setVariable('_tick', { [liquidityA.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
      await jobDisputable.setVariable('_tick', { [liquidityB.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
    });

    it('should fail to slash unexistent liquidity', async () => {
      await expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, wallet.generateRandomAddress(), 1)).to.be.revertedWith(
        'JobLiquidityUnexistent()'
      );
    });

    it('should fail to slash more than balance', async () => {
      await expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, initialLiquidityA.add(1))).to.be.revertedWith(
        'JobLiquidityInsufficient()'
      );
    });

    it('should revert if job is not disputed', async () => {
      await jobDisputable.setVariable('disputes', {
        [job]: false,
      });
      await expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove)).to.be.revertedWith(
        'NotDisputed()'
      );
    });

    it('should remove liquidity from list if there is no remaining', async () => {
      liquidityA.transfer.returns(true);

      await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, initialLiquidityA);
      expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([liquidityB.address]);
    });

    context('when liquidity is revoked', () => {
      beforeEach(async () => {
        liquidityA.transfer.returns(true);
        await jobDisputable.setRevokedLiquidity(liquidityA.address);
      });

      it('should transfer the tokens to governance', async () => {
        await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
        expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
      });

      it('should emit an event', async () => {
        await expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove))
          .to.emit(jobDisputable, 'JobSlashLiquidity')
          .withArgs(job, liquidityA.address, slasher.address, liquidityAToRemove);
      });
    });

    context('when partially slashing a liquidity', () => {
      beforeEach(async () => {
        liquidityA.transfer.returns(true);
        tx = await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
      });

      it('should transfer the tokens to governance', async () => {
        expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
      });

      it('should reduce the specified amount from liquidity accountance', async () => {
        expect(await jobDisputable.liquidityAmount(job, liquidityA.address)).to.equal(initialLiquidityA.sub(liquidityAToRemove));
      });

      it('should not remove liquidity from list if there is some remaining', async () => {
        expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([liquidityA.address, liquidityB.address]);
      });

      it('should not affect other liquidity balance', async () => {
        expect(await jobDisputable.liquidityAmount(job, liquidityB.address)).to.equal(initialLiquidityB);
      });

      it('should reduce liquidity credits proportionally', async () => {
        const totalLiquidity = initialLiquidityA.add(initialLiquidityB);
        const expected = initialLiquidityCredits.mul(totalLiquidity.sub(liquidityAToRemove)).div(totalLiquidity);
        expect(await jobDisputable.jobLiquidityCredits(job)).to.equal(expected);
      });

      it('should recalculate period credits', async () => {
        let quotedCredits: BigNumber;
        quotedCredits = mathUtils.calcPeriodCredits(initialLiquidityA.sub(liquidityAToRemove));
        quotedCredits = quotedCredits.add(mathUtils.calcPeriodCredits(initialLiquidityB));

        expect(await jobDisputable.jobPeriodCredits(job)).to.equal(quotedCredits);
      });

      it('should emit event', async () => {
        await expect(tx).to.emit(jobDisputable, 'JobSlashLiquidity').withArgs(job, liquidityA.address, slasher.address, liquidityAToRemove);
      });
    });

    context('when some transfer fails', () => {
      beforeEach(async () => {
        liquidityA.transfer.reverts();
      });

      it('should not revert', async () => {
        await expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove)).not.to.be.reverted;
      });

      it('should call the transfer function', async () => {
        await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
        expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
      });

      it('should slash the liquidity', async () => {
        await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
        expect(await jobDisputable.liquidityAmount(job, liquidityA.address)).to.equal(initialLiquidityA.sub(liquidityAToRemove));
      });
    });
  });
});
