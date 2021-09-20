import IUniswapV3PoolArtifact from '@artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import IKeep3rV1Artifact from '@contracts/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rArtifact from '@contracts/interfaces/IKeep3r.sol/IKeep3r.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IKeep3r,
  IKeep3rV1,
  IUniswapV3Pool,
  Keep3rHelperForTest,
  Keep3rHelperForTest__factory,
  Keep3rLibrary,
  ProxyForTest__factory,
} from '@types';
import { toGwei, toUnit } from '@utils/bn';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { ethers } from 'hardhat';

chai.use(solidity);

describe('Keep3rHelper', () => {
  let oraclePool: FakeContract<IUniswapV3Pool>;
  let keep3r: FakeContract<IKeep3r>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let helperFactory: MockContractFactory<Keep3rHelperForTest__factory>;
  let helper: MockContract<Keep3rHelperForTest>;
  let library: Keep3rLibrary;

  let kp3rV1Address: string;
  let oraclePoolAddress: string;
  let targetBond: BigNumber;
  let randomKeeper: SignerWithAddress;

  let rewardPeriodTime: number;
  let oneTenth: number;

  before(async () => {
    [, randomKeeper] = await ethers.getSigners();
    library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as any as Keep3rLibrary;
    helperFactory = await smock.mock<Keep3rHelperForTest__factory>('Keep3rHelperForTest', {
      libraries: { Keep3rLibrary: library.address },
    });
    keep3r = await smock.fake(IKeep3rArtifact);
    helper = await helperFactory.deploy(keep3r.address);

    oraclePoolAddress = await helper.callStatic.KP3R_WETH_POOL();
    oraclePool = await smock.fake(IUniswapV3PoolArtifact, { address: oraclePoolAddress });

    kp3rV1Address = await helper.callStatic.KP3R();
    targetBond = await helper.callStatic.TARGETBOND();

    keep3rV1 = await smock.fake(IKeep3rV1Artifact, { address: kp3rV1Address });

    /* Twap calculation:
    // 1.0001**(-23027) = 0.100000022 ~= 0.1
    */
    rewardPeriodTime = 100_000;
    oneTenth = -23027 * rewardPeriodTime;
    oraclePool.token1.returns(kp3rV1Address);
    keep3r.observeLiquidity.whenCalledWith(oraclePoolAddress).returns([0, oneTenth, 0]);
    keep3r.rewardPeriodTime.returns(rewardPeriodTime);
  });

  beforeEach(async () => {
    keep3r.bonds.reset();
  });

  describe('quote', () => {
    it('should return keep3r KP3R/WETH quote', async () => {
      const toQuote = toUnit(10);
      const quoteResult = toUnit(1);
      /*
      // 1.0001**(-23027) ~= 0.1
      */

      expect(await helper.callStatic.quote(toQuote)).to.be.closeTo(quoteResult, toUnit(0.001).toNumber());
    });
  });

  describe('bonds', () => {
    it('should return amount of KP3R bonds', async () => {
      const bondsResult = toUnit(1);
      keep3r.bonds.whenCalledWith(randomKeeper.address, keep3rV1.address).returns(bondsResult);

      expect(await helper.callStatic.bonds(randomKeeper.address)).to.equal(bondsResult);
    });
  });

  describe('getRewardAmountFor', () => {
    const baseFee = toGwei(200);
    const gasUsed = BigNumber.from(30_000_000);
    const expectedQuoteAmount = gasUsed.mul(baseFee).div(10);

    beforeEach(async () => {
      keep3r.observeLiquidity.whenCalledWith(oraclePoolAddress).returns([0, oneTenth, 0]);
      keep3r.rewardPeriodTime.returns(rewardPeriodTime);
      await helper.setVariable('basefee', baseFee);
    });

    it('should call bonds with the correct arguments', async () => {
      await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed);
      expect(keep3r.bonds).to.be.calledOnceWith(randomKeeper.address, keep3rV1.address);
    });

    it('should return at least 110% of the quote', async () => {
      expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.closeTo(
        expectedQuoteAmount.mul(11).div(10),
        toUnit(0.0001).toNumber()
      );
    });

    it('should boost the quote depending on the bonded KP3R of the keeper', async () => {
      keep3r.bonds.whenCalledWith(randomKeeper.address).returns(targetBond.sub(toUnit(1)));
      // TODO: remove as any when this is solved: https://github.com/EthWorks/Waffle/issues/561
      expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.be.within(
        expectedQuoteAmount.mul(11).div(10) as any,
        expectedQuoteAmount.mul(12).div(10) as any
      );
    });

    it('should return at most 120% of the quote', async () => {
      keep3r.bonds.whenCalledWith(randomKeeper.address, keep3rV1.address).returns(targetBond.mul(10));

      expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.closeTo(
        expectedQuoteAmount.mul(12).div(10),
        toUnit(0.0001).toNumber()
      );
    });
  });

  describe('getRewardAmount', () => {
    const baseFee = toGwei(200);
    const gasUsed = BigNumber.from(30_000_000);

    const expectedQuoteAmount = gasUsed.mul(baseFee).div(10);
    beforeEach(async () => {
      keep3r.observeLiquidity.whenCalledWith(oraclePoolAddress).returns([0, oneTenth, 0]);
      keep3r.rewardPeriodTime.returns(rewardPeriodTime);
      await helper.setVariable('basefee', baseFee);
    });

    it('should call bonds with the correct arguments', async () => {
      const proxyFactory = (await ethers.getContractFactory('ProxyForTest')) as ProxyForTest__factory;
      const proxy = await proxyFactory.deploy();

      // call getRewardAmount through proxy
      await proxy.connect(randomKeeper).call(helper.address, helper.interface.encodeFunctionData('getRewardAmount', [toUnit(1)]));

      // should use tx.origin and not msg.sender
      expect(keep3r.bonds).to.be.calledOnceWith(randomKeeper.address, keep3rV1.address);
    });

    it('should return at least 110% of the quote', async () => {
      expect(await helper.callStatic.getRewardAmount(gasUsed)).to.closeTo(expectedQuoteAmount.mul(11).div(10), toUnit(0.0001).toNumber());
    });

    it('should boost the quote depending on the bonded KP3R of the keeper', async () => {
      keep3r.bonds.returns(targetBond.sub(toUnit(1)));
      // TODO: remove as any when this is solved: https://github.com/EthWorks/Waffle/issues/561
      expect(await helper.callStatic.getRewardAmount(gasUsed)).to.be.within(
        expectedQuoteAmount.mul(11).div(10) as any,
        expectedQuoteAmount.mul(12).div(10) as any
      );
    });

    it('should return at most 120% of the quote', async () => {
      keep3r.bonds.returns(targetBond.mul(10));

      expect(await helper.callStatic.getRewardAmount(gasUsed)).to.closeTo(expectedQuoteAmount.mul(12).div(10), toUnit(0.0001).toNumber());
    });
  });

  describe('getRewardBoostFor', () => {
    const baseFee = toGwei(200);

    beforeEach(async () => {
      await helper.setVariable('basefee', baseFee);
    });

    it('should return at least 110% boost on gasPrice', async () => {
      expect(await helper.getRewardBoostFor(0)).to.be.deep.equal([baseFee.mul(11000), BigNumber.from(10000)]);
    });

    it('should boost gasPrice depending on the bonded KP3R of the keeper', async () => {
      expect((await helper.getRewardBoostFor(targetBond.sub(toUnit(1))))[0].div(baseFee)).to.be.within(11000, 12000);
    });

    it('should return at most a 120% boost on gasPrice', async () => {
      expect(await helper.getRewardBoostFor(targetBond.mul(10))).to.be.deep.equal([baseFee.mul(12000), BigNumber.from(10000)]);
    });
  });
});
