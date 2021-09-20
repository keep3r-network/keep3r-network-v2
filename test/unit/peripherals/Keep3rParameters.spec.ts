import IUniswapV3PoolArtifact from '@contracts/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IUniswapV3Pool, Keep3rLibrary, Keep3rParametersForTest, Keep3rParametersForTest__factory } from '@types';
import { behaviours, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { ETH_ADDRESS, ZERO_ADDRESS } from '@utils/constants';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

describe('Keep3rParameters', () => {
  let parameters: Keep3rParametersForTest;
  let governance: SignerWithAddress;
  let parametersFactory: Keep3rParametersForTest__factory;
  let library: Keep3rLibrary;
  let oraclePool: FakeContract<IUniswapV3Pool>;
  let newOraclePool: FakeContract<IUniswapV3Pool>;
  let invalidOraclePool: FakeContract<IUniswapV3Pool>;
  const keep3rHelper = wallet.generateRandomAddress();
  const keep3rV1 = wallet.generateRandomAddress();
  const keep3rV1Proxy = wallet.generateRandomAddress();
  const randomAddress = wallet.generateRandomAddress();

  before(async () => {
    [governance] = await ethers.getSigners();
    library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as any as Keep3rLibrary;
    parametersFactory = (await ethers.getContractFactory('Keep3rParametersForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    })) as Keep3rParametersForTest__factory;
  });

  beforeEach(async () => {
    oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token0.returns(keep3rV1);
    newOraclePool = await smock.fake(IUniswapV3PoolArtifact);
    newOraclePool.token0.returns(keep3rV1);
    invalidOraclePool = await smock.fake(IUniswapV3PoolArtifact);

    parameters = await parametersFactory.deploy(keep3rHelper, keep3rV1, keep3rV1Proxy, oraclePool.address);
  });

  [
    { name: 'setKeep3rHelper', zero: true, parameter: 'keep3rHelper', args: () => [randomAddress], event: 'Keep3rHelperChange' },
    { name: 'setKeep3rV1', zero: true, parameter: 'keep3rV1', args: () => [randomAddress], event: 'Keep3rV1Change' },
    { name: 'setKeep3rV1Proxy', zero: true, parameter: 'keep3rV1Proxy', args: () => [randomAddress], event: 'Keep3rV1ProxyChange' },
    { name: 'setkp3rWethPool', zero: true, parameter: 'kp3rWethPool', args: () => [newOraclePool.address], event: 'Kp3rWethPoolChange' },
    { name: 'setBondTime', parameter: 'bondTime', args: () => [toUnit(1)], event: 'BondTimeChange' },
    { name: 'setUnbondTime', parameter: 'unbondTime', args: () => [toUnit(1)], event: 'UnbondTimeChange' },
    { name: 'setLiquidityMinimum', parameter: 'liquidityMinimum', args: () => [toUnit(1)], event: 'LiquidityMinimumChange' },
    { name: 'setRewardPeriodTime', parameter: 'rewardPeriodTime', args: () => [toUnit(1)], event: 'RewardPeriodTimeChange' },
    { name: 'setInflationPeriod', parameter: 'inflationPeriod', args: () => [toUnit(1)], event: 'InflationPeriodChange' },
  ].forEach((method) => {
    describe(method.name, () => {
      behaviours.onlyGovernance(() => parameters, method.name, governance, method.args);

      if (method.zero) {
        it('should revert when sending zero address', async () => {
          await expect((parameters as Contract)[method.name](ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
        });
      }

      it('should assign specified value to variable', async () => {
        expect(await (parameters as Contract)[method.parameter]()).not.to.be.equal(method.args()[0]);
        await (parameters as Contract)[method.name](...method.args());
        expect(await (parameters as Contract)[method.parameter]()).to.be.equal(method.args()[0]);
      });

      it('should emit event', async () => {
        await expect((parameters as Contract)[method.name](...method.args()))
          .to.emit(parameters, method.event)
          .withArgs(...method.args());
      });
    });
  });

  describe('setkp3rWethPool', () => {
    it('should revert when setting non-contract address', async () => {
      await expect(parameters.setkp3rWethPool(ETH_ADDRESS)).to.be.revertedWith('function call to a non-contract account');
    });

    it('should revert when setting invalid pool address', async () => {
      await expect(parameters.setkp3rWethPool(invalidOraclePool.address)).to.be.revertedWith('LiquidityPairInvalid()');
    });
  });

  describe('constructor', () => {
    it('should set keep3rHelper', async () => {
      expect(await parameters.keep3rHelper()).to.be.equal(keep3rHelper);
    });
    it('should set keep3rV1', async () => {
      expect(await parameters.keep3rV1()).to.be.equal(keep3rV1);
    });
    it('should set keep3rV1Proxy', async () => {
      expect(await parameters.keep3rV1Proxy()).to.be.equal(keep3rV1Proxy);
    });
    it('should set kp3rWethPool', async () => {
      expect(await parameters.kp3rWethPool()).to.be.equal(oraclePool.address);
    });
  });
});
