import IUniswapV3PoolArtifact from '@contracts/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
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
  Keep3rJobDisputableForTest,
  Keep3rJobDisputableForTest__factory,
  UniV3PairManager,
} from '@types';
import { wallet } from '@utils';
import { onlySlasherOrGovernance } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import { expectEventsFromTx } from '@utils/event-utils';
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
  let tokenA: FakeContract<ERC20>;
  let tokenB: FakeContract<ERC20>;
  let liquidityA: FakeContract<UniV3PairManager>;
  let liquidityB: FakeContract<UniV3PairManager>;
  let oraclePool: FakeContract<IUniswapV3PoolForTest>;

  // Parameter and function equivalent to contract's
  let rewardPeriodTime: number;
  let inflationPeriodTime: number;

  let mathUtils: MathUtils;

  before(async () => {
    [governance, slasher, disputer] = await ethers.getSigners();
    const library = await (await ethers.getContractFactory('Keep3rLibrary')).deploy();

    jobDisputableFactory = await smock.mock('Keep3rJobDisputableForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
  });

  beforeEach(async () => {
    helper = await smock.fake(IKeep3rHelperArtifact);
    keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token0.returns(keep3rV1.address);

    jobDisputable = await jobDisputableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);

    await jobDisputable.setVariable('slashers', { [slasher.address]: true });
    await jobDisputable.setVariable('disputers', { [disputer.address]: true });

    rewardPeriodTime = (await jobDisputable.rewardPeriodTime()).toNumber();
    inflationPeriodTime = (await jobDisputable.inflationPeriod()).toNumber();

    mathUtils = mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);

    await jobDisputable.setVariable('disputes', {
      [job]: true,
    });

    oraclePool.observe.returns([[0, 0], []]);
  });

  describe('slashJob', () => {
    beforeEach(async () => {
      // setup tokens
      tokenA = await smock.fake<ERC20>(ERC20Artifact);
      tokenB = await smock.fake<ERC20>(ERC20Artifact);
      liquidityA = await smock.fake<UniV3PairManager>(IUniswapV3PoolArtifact);
      liquidityB = await smock.fake<UniV3PairManager>(IUniswapV3PoolArtifact);
      tokenA.transfer.returns(true);
      tokenB.transfer.returns(true);
      liquidityA.transfer.returns(true);
      liquidityB.transfer.returns(true);

      await jobDisputable.setVariable('_liquidityPool', { [liquidityA.address]: oraclePool.address });
      await jobDisputable.setVariable('_liquidityPool', { [liquidityB.address]: oraclePool.address });

      await jobDisputable.setJobToken(job, tokenA.address);
      await jobDisputable.setJobToken(job, tokenB.address);
      await jobDisputable.setVariable('jobTokenCredits', {
        [job]: {
          [tokenA.address]: toUnit(1),
          [tokenB.address]: toUnit(2),
        },
      });

      // setup liquidity
      await jobDisputable.setJobLiquidity(job, liquidityA.address);
      await jobDisputable.setJobLiquidity(job, liquidityB.address);
      await jobDisputable.setVariable('liquidityAmount', {
        [job]: {
          [liquidityA.address]: toUnit(3),
          [liquidityB.address]: toUnit(4),
        },
      });

      // setup credits
      await jobDisputable.setVariable('_jobLiquidityCredits', {
        [job]: toUnit(5),
      });
      await jobDisputable.setVariable('_jobPeriodCredits', {
        [job]: toUnit(6),
      });
    });

    onlySlasherOrGovernance(
      () => jobDisputable,
      'slashJob',
      () => [slasher, governance],
      [job]
    );

    it('should revert if job is not disputed', async () => {
      await jobDisputable.setVariable('disputes', {
        [job]: false,
      });
      await expect(jobDisputable.slashJob(job)).to.be.revertedWith('NotDisputed()');
    });

    context('when job is slashed', () => {
      let tx: ContractTransaction;

      beforeEach(async () => {
        tx = await jobDisputable.slashJob(job);
      });

      it('should emit event', async () => {
        await expectEventsFromTx(tx, [
          {
            name: 'JobSlash',
            args: [job],
          },
        ]);
      });

      it('should resolve the dispute', async () => {
        expect(await jobDisputable.disputes(job)).to.equal(false);
      });

      context('tokens', () => {
        it('should empty list', async () => {
          expect(await jobDisputable.internalJobTokens(job)).to.deep.equal([]);
        });

        it('should slash all of the credits', async () => {
          expect(await jobDisputable.jobTokenCredits(job, tokenA.address)).to.equal(0);
          expect(await jobDisputable.jobTokenCredits(job, tokenB.address)).to.equal(0);
        });

        it('should transfer all of them to governance', async () => {
          expect(tokenA.transfer).to.be.calledOnceWith(governance.address, toUnit(1));
          expect(tokenB.transfer).to.be.calledOnceWith(governance.address, toUnit(2));
        });
      });

      context('liquidities', () => {
        it('should empty list', async () => {
          expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([]);
        });

        it('should slash all of them', async () => {
          expect(await jobDisputable.liquidityAmount(job, liquidityA.address)).to.equal(0);
          expect(await jobDisputable.liquidityAmount(job, liquidityB.address)).to.equal(0);
        });

        it('should transfer all of them to governance', async () => {
          expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, toUnit(3));
          expect(liquidityB.transfer).to.be.calledOnceWith(governance.address, toUnit(4));
        });
      });

      context('credits', () => {
        it('should reset liquidity credits to 0', async () => {
          expect(await jobDisputable.internalJobLiquidityCredits(job)).to.equal(0);
        });

        it('should reset period credits to 0', async () => {
          expect(await jobDisputable.internalJobPeriodCredits(job)).to.equal(0);
        });
      });
    });

    context('when some transfer fails', () => {
      beforeEach(async () => {
        tokenA.transfer.reverts();
      });

      it('should not revert', async () => {
        await expect(jobDisputable.slashJob(job)).not.to.be.reverted;
      });

      it('should slash other liquidities', async () => {
        await jobDisputable.slashJob(job);
        expect(liquidityA.transfer).to.be.calledOnce;
        expect(liquidityB.transfer).to.be.calledOnce;
      });
    });
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
      await expect(jobDisputable.slashTokenFromJob(job, wallet.generateRandomAddress(), 1)).to.be.revertedWith('JobTokenUnexistent()');
    });

    it('should fail to slash more than balance', async () => {
      await expect(jobDisputable.slashTokenFromJob(job, tokenA.address, initialTokenA.add(1))).to.be.revertedWith('JobTokenInsufficient()');
    });

    it('should revert if job is not disputed', async () => {
      await jobDisputable.setVariable('disputes', {
        [job]: false,
      });
      await expect(jobDisputable.slashTokenFromJob(job, tokenA.address, initialTokenA)).to.be.revertedWith('NotDisputed()');
    });

    it('should remove token from list if there is no remaining', async () => {
      await jobDisputable.slashTokenFromJob(job, tokenA.address, initialTokenA);
      expect(await jobDisputable.internalJobTokens(job)).to.deep.equal([tokenB.address]);
    });

    context('when partially slashing a token', () => {
      beforeEach(async () => {
        tokenA.transfer.returns(true);
        tx = await jobDisputable.slashTokenFromJob(job, tokenA.address, tokenAToRemove);
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
        await expectEventsFromTx(tx, [
          {
            name: 'JobSlashToken',
            args: [job, tokenA.address, tokenAToRemove],
          },
        ]);
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
      await jobDisputable.setVariable('_liquidityPool', { [liquidityA.address]: oraclePool.address });
      await jobDisputable.setVariable('_liquidityPool', { [liquidityB.address]: oraclePool.address });

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
    });

    it('should fail to slash unexistent liquidity', async () => {
      await expect(jobDisputable.slashLiquidityFromJob(job, wallet.generateRandomAddress(), 1)).to.be.revertedWith('JobLiquidityUnexistent()');
    });

    it('should fail to slash more than balance', async () => {
      await expect(jobDisputable.slashLiquidityFromJob(job, liquidityA.address, initialLiquidityA.add(1))).to.be.revertedWith(
        'JobLiquidityInsufficient()'
      );
    });

    it('should revert if job is not disputed', async () => {
      await jobDisputable.setVariable('disputes', {
        [job]: false,
      });
      await expect(jobDisputable.slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove)).to.be.revertedWith('NotDisputed()');
    });

    it('should remove liquidity from list if there is no remaining', async () => {
      liquidityA.transfer.returns(true);

      await jobDisputable.slashLiquidityFromJob(job, liquidityA.address, initialLiquidityA);
      expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([liquidityB.address]);
    });

    context('when partially slashing a liquidity', () => {
      beforeEach(async () => {
        liquidityA.transfer.returns(true);
        tx = await jobDisputable.slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
      });

      it('should transfer the tokens to governance', async () => {
        expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
      });

      it('should reduce the specified amount from balance', async () => {
        expect(await jobDisputable.liquidityAmount(job, liquidityA.address)).to.equal(initialLiquidityA.sub(liquidityAToRemove));
      });

      it('should not remove liquidity from list if there is some remaining', async () => {
        expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([liquidityA.address, liquidityB.address]);
      });

      it('should reduce liquidity credits proportion', async () => {
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

      it('should not affect other liquidity balance', async () => {
        expect(await jobDisputable.liquidityAmount(job, liquidityB.address)).to.equal(initialLiquidityB);
      });

      it('should emit event', async () => {
        await expectEventsFromTx(tx, [
          {
            name: 'JobSlashLiquidity',
            args: [job, liquidityA.address, liquidityAToRemove],
          },
        ]);
      });
    });

    context('when liquidity is revoked', () => {
      beforeEach(async () => {
        liquidityA.transfer.returns(true);
        await jobDisputable.setRevokedLiquidity(liquidityA.address);
      });

      it('should transfer the tokens to governance', async () => {
        await jobDisputable.slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
        expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
      });
    });
  });
});
