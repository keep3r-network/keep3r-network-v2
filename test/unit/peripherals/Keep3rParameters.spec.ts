import { FakeContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rHelper, Keep3rParametersForTest, Keep3rParametersForTest__factory } from '@types';
import { behaviours, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { ZERO_ADDRESS } from '@utils/constants';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

describe('Keep3rParameters', () => {
  let parameters: Keep3rParametersForTest;
  let governance: SignerWithAddress;
  let parametersFactory: Keep3rParametersForTest__factory;
  let keep3rHelper: FakeContract<Keep3rHelper>;
  const newOraclePool = wallet.generateRandomAddress();
  const oraclePool = wallet.generateRandomAddress();
  const keep3rV1 = wallet.generateRandomAddress();
  const keep3rV1Proxy = wallet.generateRandomAddress();
  const randomAddress = wallet.generateRandomAddress();

  before(async () => {
    [governance] = await ethers.getSigners();

    parametersFactory = (await ethers.getContractFactory('Keep3rParametersForTest')) as Keep3rParametersForTest__factory;
  });

  beforeEach(async () => {
    keep3rHelper = await smock.fake('Keep3rHelper');

    parameters = await parametersFactory.deploy(keep3rHelper.address, keep3rV1, keep3rV1Proxy, oraclePool);
  });

  [
    { name: 'setKeep3rHelper', zero: true, parameter: 'keep3rHelper', args: () => [randomAddress], event: 'Keep3rHelperChange' },
    { name: 'setKeep3rV1', zero: true, parameter: 'keep3rV1', args: () => [randomAddress], event: 'Keep3rV1Change' },
    { name: 'setKeep3rV1Proxy', zero: true, parameter: 'keep3rV1Proxy', args: () => [randomAddress], event: 'Keep3rV1ProxyChange' },
    { name: 'setKp3rWethPool', zero: true, parameter: 'kp3rWethPool', args: () => [newOraclePool], event: 'Kp3rWethPoolChange' },
    { name: 'setBondTime', parameter: 'bondTime', args: () => [toUnit(1)], event: 'BondTimeChange' },
    { name: 'setUnbondTime', parameter: 'unbondTime', args: () => [toUnit(1)], event: 'UnbondTimeChange' },
    { name: 'setLiquidityMinimum', parameter: 'liquidityMinimum', args: () => [toUnit(1)], event: 'LiquidityMinimumChange' },
    { name: 'setRewardPeriodTime', parameter: 'rewardPeriodTime', args: () => [toUnit(1)], event: 'RewardPeriodTimeChange' },
    { name: 'setInflationPeriod', parameter: 'inflationPeriod', args: () => [toUnit(1)], event: 'InflationPeriodChange' },
    { name: 'setFee', parameter: 'fee', args: () => [10], event: 'FeeChange' },
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

  describe('setKp3rWethPool', () => {
    it('should set the corresponding oracle pool', async () => {
      await parameters.setKp3rWethPool(newOraclePool);

      expect(await parameters.viewLiquidityPool(newOraclePool)).to.be.eq(newOraclePool);
    });

    it('should set the order of KP3R in the pool', async () => {
      keep3rHelper.isKP3RToken0.returns(true);
      await parameters.setKp3rWethPool(newOraclePool);

      expect(await parameters.viewIsKP3RToken0(newOraclePool)).to.be.true;
    });
  });

  describe('constructor', () => {
    it('should set keep3rHelper', async () => {
      expect(await parameters.keep3rHelper()).to.be.equal(keep3rHelper.address);
    });

    it('should set keep3rV1', async () => {
      expect(await parameters.keep3rV1()).to.be.equal(keep3rV1);
    });

    it('should set keep3rV1Proxy', async () => {
      expect(await parameters.keep3rV1Proxy()).to.be.equal(keep3rV1Proxy);
    });

    it('should set kp3rWethPool', async () => {
      expect(await parameters.kp3rWethPool()).to.be.equal(oraclePool);
    });
  });
});
