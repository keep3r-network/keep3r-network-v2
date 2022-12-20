import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IKeep3rV1Proxy, Keep3rHelper, Keep3rParametersForTest, Keep3rParametersForTest__factory } from '@types';
import { behaviours, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { ZERO_ADDRESS } from '@utils/constants';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

describe('Keep3rParameters', () => {
  let parameters: MockContract<Keep3rParametersForTest>;
  let governance: SignerWithAddress;
  let parametersFactory: MockContractFactory<Keep3rParametersForTest__factory>;
  let keep3rHelper: FakeContract<Keep3rHelper>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  const keep3rV1 = wallet.generateRandomAddress();
  const randomAddress = wallet.generateRandomAddress();

  before(async () => {
    [governance] = await ethers.getSigners();

    keep3rV1Proxy = await smock.fake<IKeep3rV1Proxy>('IKeep3rV1Proxy');
    parametersFactory = await smock.mock<Keep3rParametersForTest__factory>('Keep3rParametersForTest');
  });

  beforeEach(async () => {
    keep3rHelper = await smock.fake('Keep3rHelper');

    parameters = await parametersFactory.deploy(keep3rHelper.address, keep3rV1, keep3rV1Proxy.address);
  });

  [
    { name: 'setKeep3rHelper', zero: true, parameter: 'keep3rHelper', args: () => [randomAddress], event: 'Keep3rHelperChange' },
    { name: 'setKeep3rV1', zero: true, parameter: 'keep3rV1', args: () => [randomAddress], event: 'Keep3rV1Change' },
    { name: 'setKeep3rV1Proxy', zero: true, parameter: 'keep3rV1Proxy', args: () => [randomAddress], event: 'Keep3rV1ProxyChange' },
    { name: 'setBondTime', parameter: 'bondTime', args: () => [toUnit(1)], event: 'BondTimeChange' },
    { name: 'setUnbondTime', parameter: 'unbondTime', args: () => [toUnit(1)], event: 'UnbondTimeChange' },
    { name: 'setLiquidityMinimum', parameter: 'liquidityMinimum', args: () => [toUnit(1)], event: 'LiquidityMinimumChange' },
    { name: 'setRewardPeriodTime', parameter: 'rewardPeriodTime', args: () => [toUnit(1)], event: 'RewardPeriodTimeChange' },
    { name: 'setInflationPeriod', parameter: 'inflationPeriod', args: () => [toUnit(1)], event: 'InflationPeriodChange' },
    { name: 'setFee', parameter: 'fee', args: () => [10], event: 'FeeChange' },
  ].forEach((method) => {
    describe(method.name, () => {
      let parametersContract: Contract;
      behaviours.onlyGovernance(() => parameters, method.name, governance, method.args);

      beforeEach(async () => {
        parametersContract = parameters as unknown as Contract;
      });

      if (method.zero) {
        it('should revert when sending zero address', async () => {
          await expect(parametersContract[method.name](ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
        });
      }

      it('should assign specified value to variable', async () => {
        expect(await parametersContract[method.parameter]()).not.to.be.equal(method.args()[0]);
        await parametersContract[method.name](...method.args());
        expect(await parametersContract[method.parameter]()).to.be.equal(method.args()[0]);
      });

      it('should emit event', async () => {
        await expect(parametersContract[method.name](...method.args()))
          .to.emit(parameters, method.event)
          .withArgs(...method.args());
      });
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
      expect(await parameters.keep3rV1Proxy()).to.be.equal(keep3rV1Proxy.address);
    });
  });

  describe('setKeep3rV1', () => {
    const BONDS = toUnit(10);

    beforeEach(async () => {
      await parameters.setVariable('totalBonds', BONDS);
    });

    it('should trigger settlement of totalBonds', async () => {
      keep3rV1Proxy['mint(uint256)'].reset();
      await parameters.setKeep3rV1(randomAddress);
      expect(keep3rV1Proxy['mint(uint256)']).to.have.been.calledWith(BONDS);
    });

    it('should reset totalBonds', async () => {
      await parameters.setKeep3rV1(randomAddress);
      await parameters.setVariable('totalBonds', 0);
    });
  });
});
