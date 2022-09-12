import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { KP3R_V1_ADDRESS, WETH_ADDRESS } from '@e2e/common';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IKeep3r, IUniswapV3Pool, Keep3rHelperSidechain, Keep3rHelperSidechain__factory } from '@types';
import { bn, evm, wallet } from '@utils';
import { onlyGovernance } from '@utils/behaviours';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

const DAY = 86400;

describe('Keep3rHelperSidechain', () => {
  let governance: SignerWithAddress;
  let helper: MockContract<Keep3rHelperSidechain>;
  let keep3rHelperSidechainFactory: MockContractFactory<Keep3rHelperSidechain__factory>;
  let keep3r: FakeContract<IKeep3r>;
  let kp3rWethOracle: FakeContract<IUniswapV3Pool>;
  let wethUsdOracle: FakeContract<IUniswapV3Pool>;
  let otherPool: FakeContract<IUniswapV3Pool>;
  let snapshotId: string;

  before(async () => {
    [, governance] = await ethers.getSigners();
    keep3r = await smock.fake('IKeep3r');
    kp3rWethOracle = await smock.fake('IUniswapV3Pool');
    wethUsdOracle = await smock.fake('IUniswapV3Pool');
    otherPool = await smock.fake('IUniswapV3Pool');

    kp3rWethOracle.token0.reset();
    kp3rWethOracle.token1.reset();
    wethUsdOracle.token0.reset();
    wethUsdOracle.token1.reset();

    kp3rWethOracle.token1.returns(KP3R_V1_ADDRESS);
    wethUsdOracle.token1.returns(WETH_ADDRESS);

    keep3rHelperSidechainFactory = await smock.mock<Keep3rHelperSidechain__factory>('Keep3rHelperSidechain');
    helper = await keep3rHelperSidechainFactory.deploy(keep3r.address, governance.address, kp3rWethOracle.address, wethUsdOracle.address);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    it('should initialize keep3r to the address passed to the constructor', async () => {
      expect(await helper.keep3rV2()).to.eq(keep3r.address);
    });

    it('should initialize governance to the address passed to the constructor', async () => {
      expect(await helper.governance()).to.eq(governance.address);
    });

    it('should initialize kp3rWethOracle to the address passed to the constructor', async () => {
      const kp3rWethPool = await helper.kp3rWethPool();
      expect(kp3rWethPool.poolAddress).to.eq(kp3rWethOracle.address);
      expect(kp3rWethPool.isTKNToken0).to.eq(false);
    });

    it('should initialize kp3rWethOracle with the correct token0', async () => {
      kp3rWethOracle.token0.returns(KP3R_V1_ADDRESS);

      const deployed = await keep3rHelperSidechainFactory.deploy(
        keep3r.address,
        governance.address,
        kp3rWethOracle.address,
        wethUsdOracle.address
      );

      const kp3rWethPool = await deployed.kp3rWethPool();
      expect(kp3rWethPool.isTKNToken0).to.eq(true);
    });

    it('should initialize wethUsdOracle to the address passed to the constructor', async () => {
      const wethUSDPool = await helper.wethUSDPool();
      expect(wethUSDPool.poolAddress).to.eq(wethUsdOracle.address);
      expect(wethUSDPool.isTKNToken0).to.eq(false);
    });

    it('should initialize wethUsdOracle with the correct token0', async () => {
      wethUsdOracle.token0.returns(WETH_ADDRESS);

      const deployed = await keep3rHelperSidechainFactory.deploy(
        keep3r.address,
        governance.address,
        kp3rWethOracle.address,
        wethUsdOracle.address
      );

      const wethUSDPool = await deployed.wethUSDPool();
      expect(wethUSDPool.isTKNToken0).to.eq(true);
    });

    it('should initialize quote twap time to 1 day', async () => {
      const twapTime = await helper.quoteTwapTime();

      expect(twapTime).to.eq(DAY);
    });
  });

  describe('bonds', () => {
    const randomNumber = 420;
    const randomAddress = wallet.generateRandomAddress();
    const wKP3R = wallet.generateRandomAddress();

    beforeEach(async () => {
      keep3r.keep3rV1.reset();
      keep3r.bonds.reset();
      keep3r.keep3rV1.returns(wKP3R);

      await helper.bonds(randomAddress);
    });

    it('should call Keep3rSidechain querying wKP3R address', async () => {
      expect(keep3r.keep3rV1).to.have.been.calledOnce;
    });

    it('should query wKP3R bonds for inputted address', async () => {
      expect(keep3r.bonds).to.have.been.calledOnceWith(randomAddress, wKP3R);
    });

    it('should return the queried result', async () => {
      keep3r.bonds.returns(randomNumber);
      expect(await helper.bonds(randomAddress)).to.be.eq(randomNumber);
    });
  });

  describe('setOracle', () => {
    onlyGovernance(
      () => helper,
      'setOracle',
      () => governance,
      [wallet.generateRandomAddress(), wallet.generateRandomAddress()]
    );

    it('should store oracle address for given liquidity', async () => {
      const liquidity = wallet.generateRandomAddress();
      const oracle = wallet.generateRandomAddress();

      await helper.connect(governance).setOracle(liquidity, oracle);

      expect(await helper.oracle(liquidity)).to.eq(oracle);
    });
  });

  describe('quoteUsdToEth', () => {
    // Twap calculation: 1.0001 ** (-23027) = 0.100000022 ~= 0.1
    const oneTenthTick0 = -23027 * DAY;
    const oneTenthTick1 = 0;

    it('should return WETH/USD quote', async () => {
      wethUsdOracle.observe.returns([[oneTenthTick0, oneTenthTick1], []]);

      const toQuote = bn.toUnit(10);
      const quoteResult = bn.toUnit(1);

      const actualQuote = await helper.callStatic.quoteUsdToEth(toQuote);
      expect(actualQuote).to.be.closeTo(quoteResult, bn.toUnit(0.001).toNumber());
    });
  });

  context('setWethUsdPool', () => {
    onlyGovernance(
      () => helper,
      'setWethUsdPool',
      governance,
      () => [otherPool.address]
    );

    it('should set wethUSDPool isTKNToken0 to true if WETH is token0', async () => {
      otherPool.token0.returns(WETH_ADDRESS);
      await helper.connect(governance).setWethUsdPool(otherPool.address);
      const isTKNToken0 = (await helper.callStatic.wethUSDPool()).isTKNToken0;
      expect(isTKNToken0).to.be.true;
    });

    it('should set wethUSDPool isTKNToken0 to false if WETH is not token0', async () => {
      otherPool.token0.returns(wallet.generateRandomAddress());
      otherPool.token1.returns(WETH_ADDRESS);

      await helper.connect(governance).setWethUsdPool(otherPool.address);
      const isTKNToken0 = (await helper.callStatic.wethUSDPool()).isTKNToken0;
      expect(isTKNToken0).to.be.false;
    });

    it('should revert if pool does not contain KP3R as token0 nor token1', async () => {
      otherPool.token0.returns(wallet.generateRandomAddress());
      otherPool.token1.returns(wallet.generateRandomAddress());

      await expect(helper.connect(governance).setWethUsdPool(otherPool.address)).to.be.revertedWith('InvalidOraclePool()');
    });

    it('should emit event', async () => {
      otherPool.token0.returns(WETH_ADDRESS);
      await expect(helper.connect(governance).setWethUsdPool(otherPool.address))
        .to.emit(helper, 'WethUSDPoolChange')
        .withArgs(otherPool.address, true);
    });
  });
});
