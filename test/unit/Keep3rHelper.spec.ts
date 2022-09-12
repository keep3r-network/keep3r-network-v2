import IUniswapV3PoolArtifact from '@artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { KP3R_V1_ADDRESS } from '@e2e/common';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import IKeep3rV1Artifact from '@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rArtifact from '@solidity/interfaces/IKeep3r.sol/IKeep3r.json';
import { IKeep3r, IKeep3rV1, IUniswapV3Pool, Keep3rHelperForTest, Keep3rHelperForTest__factory, ProxyForTest__factory } from '@types';
import { behaviours, wallet } from '@utils';
import { toGwei, toUnit } from '@utils/bn';
import { MathUtils, mathUtilsFactory } from '@utils/math';
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

  let kp3rV1Address: string;
  let targetBond: BigNumber;
  let governance: SignerWithAddress;
  let randomKeeper: SignerWithAddress;

  let workExtraGas: BigNumber;
  let quoteTwapTime: number;
  let oneTenthTick0: BigNumber;
  let oneTenthTick1: BigNumber;

  let mathUtils: MathUtils;

  before(async () => {
    [, governance, randomKeeper] = await ethers.getSigners();

    helperFactory = await smock.mock<Keep3rHelperForTest__factory>('Keep3rHelperForTest');
    keep3r = await smock.fake(IKeep3rArtifact);
    oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token1.returns(KP3R_V1_ADDRESS);
    helper = await helperFactory.deploy(keep3r.address, governance.address, oraclePool.address);

    kp3rV1Address = await helper.callStatic.KP3R();
    targetBond = await helper.callStatic.targetBond();
    quoteTwapTime = await helper.callStatic.quoteTwapTime();
    workExtraGas = await helper.callStatic.workExtraGas();

    // Twap calculation: 1.0001 ** (-23027) = 0.100000022 ~= 0.1
    oneTenthTick0 = BigNumber.from(-23027).mul(quoteTwapTime);
    oneTenthTick1 = BigNumber.from(0);

    keep3rV1 = await smock.fake(IKeep3rV1Artifact, { address: kp3rV1Address });
    mathUtils = mathUtilsFactory(0, 0);

    oraclePool.observe.returns([[oneTenthTick0, oneTenthTick1], []]);
  });

  beforeEach(async () => {
    keep3r.bonds.reset();
  });

  describe('quote', () => {
    it('should return keep3r KP3R/WETH quote', async () => {
      const toQuote = toUnit(10);
      const quoteResult = toUnit(1);

      const actualQuote = await helper.callStatic.quote(toQuote);
      expect(actualQuote).to.be.closeTo(quoteResult, toUnit(0.001).toNumber());
    });

    it('should work with 100 ETH', async () => {
      await expect(helper.quote(toUnit(100))).not.to.be.reverted;
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
    let expectedQuoteAmount: BigNumber;

    beforeEach(async () => {
      expectedQuoteAmount = gasUsed.mul(baseFee).div(10);
      await helper.setVariable('basefee', baseFee);
      await helper.setVariable('minBaseFee', 0);
      await helper.setVariable('minPriorityFee', 0);
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

    it('should reward a minimum gas fee if block baseFee is too low', async () => {
      await helper.setVariable('basefee', 0);
      const minBaseFee = toGwei(100);
      await helper.setVariable('minBaseFee', minBaseFee);
      expectedQuoteAmount = gasUsed.mul(minBaseFee).div(10);

      expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.closeTo(
        expectedQuoteAmount.mul(11).div(10),
        toUnit(0.0001).toNumber()
      );
    });

    it('should reward a minimum priority fee to the keeper', async () => {
      const minPriorityFee = toGwei(10);
      await helper.setVariable('minPriorityFee', minPriorityFee);
      expectedQuoteAmount = gasUsed.mul(baseFee.add(minPriorityFee)).div(10);

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

    it('should use a minimum gas fee if baseFee is too low', async () => {
      keep3r.bonds.whenCalledWith(randomKeeper.address, keep3rV1.address).returns(targetBond.mul(10));

      const minBaseFee = await helper.minBaseFee();
      expectedQuoteAmount = gasUsed.mul(minBaseFee).div(10);
      await helper.setVariable('basefee', 0);

      expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.closeTo(
        expectedQuoteAmount.mul(12).div(10),
        toUnit(0.0001).toNumber()
      );
    });
  });

  describe('getRewardAmount', () => {
    const baseFee = toGwei(200);
    const gasUsed = BigNumber.from(30_000_000);
    let expectedQuoteAmount: BigNumber;

    beforeEach(async () => {
      expectedQuoteAmount = gasUsed.mul(baseFee).div(10);
      await helper.setVariable('basefee', baseFee);
    });

    it('should call bonds with the correct arguments', async () => {
      const proxyFactory = (await ethers.getContractFactory('ProxyForTest')) as ProxyForTest__factory;
      const proxy = await proxyFactory.deploy();

      // call getRewardAmount through proxy
      await proxy.connect(randomKeeper).call(helper.address, helper.interface.encodeFunctionData('getRewardAmount', [gasUsed]));

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
      expect(await helper.getRewardBoostFor(0)).to.be.eq(baseFee.mul(11000));
    });

    it('should boost gasPrice depending on the bonded KP3R of the keeper', async () => {
      const min = 11000;
      const max = 12000;
      expect((await helper.getRewardBoostFor(targetBond.div(2))).div(baseFee)).to.be.eq((min + max) / 2);
    });

    it('should return at most a 120% boost on gasPrice', async () => {
      expect(await helper.getRewardBoostFor(targetBond.mul(10))).to.be.be.eq(baseFee.mul(12000));
    });
  });

  describe('getPoolTokens', () => {
    it('should return the underlying tokens of the requested pool', async () => {
      const token0 = wallet.generateRandomAddress();
      const token1 = wallet.generateRandomAddress();

      oraclePool.token0.returns(token0);
      oraclePool.token1.returns(token1);

      expect(await helper.getPoolTokens(oraclePool.address)).to.deep.eq([token0, token1]);
    });
  });

  describe('isKP3RToken0', () => {
    it('should revert if none of the underlying tokens is KP3R', async () => {
      oraclePool.token0.returns(wallet.generateRandomAddress());
      oraclePool.token1.returns(wallet.generateRandomAddress());

      await expect(helper.isKP3RToken0(oraclePool.address)).to.be.revertedWith('LiquidityPairInvalid()');
    });

    it('should return true if KP3R is token0 of the pool', async () => {
      oraclePool.token0.returns(await helper.KP3R());
      oraclePool.token1.returns(wallet.generateRandomAddress());

      expect(await helper.isKP3RToken0(oraclePool.address)).to.be.true;
    });

    it('should return false if KP3R is token0 of the pool', async () => {
      oraclePool.token0.returns(wallet.generateRandomAddress());
      oraclePool.token1.returns(await helper.KP3R());

      expect(await helper.isKP3RToken0(oraclePool.address)).to.be.false;
    });
  });

  describe('observe', () => {
    const secondsAgo = [10];
    const tick1 = BigNumber.from(1);

    beforeEach(() => {
      oraclePool.observe.reset();
      oraclePool.observe.returns([[tick1], []]);
    });

    it('should return false success when observe fails', async () => {
      oraclePool.observe.reverts();
      const result = await helper.callStatic.observe(oraclePool.address, secondsAgo);
      expect(result).to.deep.equal([BigNumber.from(0), BigNumber.from(0), false]);
    });

    it('should call pool observe with given seconds ago', async () => {
      await helper.callStatic.observe(oraclePool.address, secondsAgo);
      expect(oraclePool.observe).to.be.calledOnceWith(secondsAgo);
    });

    it('should return response first item', async () => {
      const result = await helper.callStatic.observe(oraclePool.address, secondsAgo);
      expect(result).to.deep.equal([tick1, BigNumber.from(0), true]);
    });

    it('should return response first and second item if given', async () => {
      const tick2 = BigNumber.from(2);
      oraclePool.observe.returns([[tick1, tick2, 123], []]);
      const result = await helper.callStatic.observe(oraclePool.address, secondsAgo);
      expect(result).to.deep.equal([tick1, tick2, true]);
    });
  });

  describe('getKP3RsAtTick', () => {
    const precision = 1_000_000;
    const liquidityAmount = toUnit(1);
    const tickTimeDifference = 1;
    const tick2 = 0;

    it('should calculate the underlying tokens from a UniswapV3Pool liquidity', async () => {
      /* Calculation
      // liquidity = sqrt( x * y )
      // sqrtPrice = sqrt( y / x )
      // sqrtPrice = 1.0001 ^ tick/2 = 1.0001 ^ (t1-t2)/2*tickTimeDifference
      // x = liquidity / sqrtPrice
      */

      // Twap calculation: 1.0001 ** (-23027) = 0.100000022 ~= 0.1
      const tick1 = 23027;

      const sqrtPrice = 1.0001 ** (((tick1 - tick2) / 2) * tickTimeDifference);
      const expectedKP3Rs = liquidityAmount.mul(precision).div(Math.floor(sqrtPrice * precision));

      expect(await helper.getKP3RsAtTick(liquidityAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(
        expectedKP3Rs,
        toUnit(0.0001).toNumber()
      );
    });

    it('should return a decreased amount if tick is increased', async () => {
      const tick1 = 1;

      expect(await helper.getKP3RsAtTick(liquidityAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(
        mathUtils.decrease1Tick(liquidityAmount),
        toUnit(0.0001).toNumber()
      );
    });

    it('should return a increased amount if tick is decreased', async () => {
      const tick1 = -1;

      expect(await helper.getKP3RsAtTick(liquidityAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(
        mathUtils.increase1Tick(liquidityAmount),
        toUnit(0.0001).toNumber()
      );
    });
  });

  describe('getQuoteAtTick', () => {
    const precision = 1_000_000;
    const baseAmount = toUnit(3);
    const tickTimeDifference = 1;
    // Twap calculation: 1.0001 ** (-23027) = 0.100000022 ~= 0.1
    const tick1 = -23027;
    const tick2 = 0;

    it('should calculate a token conversion from a tick', async () => {
      /* Calculation
      // sqrtPrice = sqrt( y / x )
      // price = 1.0001 ^ tick = 1.0001 ^ (t2-t1)/tickTimeDifference
      // x = price * y
      */

      const price = 1.0001 ** ((tick1 - tick2) / tickTimeDifference);
      const expectedQuote = baseAmount.mul(precision).div(Math.floor(price * precision));

      expect(await helper.getQuoteAtTick(baseAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(
        expectedQuote,
        toUnit(0.00001).toNumber()
      );
    });
  });

  describe('setWorkExtraGas', () => {
    const newValue = 123;
    behaviours.onlyGovernance(() => helper, 'setWorkExtraGas', governance, [newValue]);

    it('should assign specified value to variable', async () => {
      expect(await helper.callStatic.workExtraGas()).not.to.equal(newValue);
      await helper.connect(governance).setWorkExtraGas(newValue);
      expect(await helper.callStatic.workExtraGas()).to.equal(newValue);
    });

    it('should emit event', async () => {
      await expect(helper.connect(governance).setWorkExtraGas(newValue)).to.emit(helper, 'WorkExtraGasChange').withArgs(newValue);
    });
  });

  describe('getPaymentParams', () => {
    const bonds = toUnit(150);

    let boost: BigNumber;
    let oneEthQuote: BigNumber;
    let extraGas: BigNumber;

    before(async () => {
      [boost, oneEthQuote, extraGas] = await helper.callStatic.getPaymentParams(bonds);
    });

    it('should return 1 eth quoted with getQuoteAtTick', async () => {
      const expectedQuote = await helper.callStatic.quote(toUnit(1));
      expect(expectedQuote).to.equal(oneEthQuote);
    });

    it('should return boost from getRewardBoostFor', async () => {
      const expectedBoost = await helper.callStatic.getRewardBoostFor(bonds);
      expect(expectedBoost).to.equal(boost);
    });

    it('should return workExtraGas', async () => {
      const expectedExtraGas = await helper.callStatic.workExtraGas();
      expect(expectedExtraGas).to.equal(extraGas);
    });
  });
});
