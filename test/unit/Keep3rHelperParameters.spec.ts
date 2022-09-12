import { FakeContract, smock } from '@defi-wonderland/smock';
import { KP3R_V1_ADDRESS } from '@e2e/common';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IUniswapV3Pool, Keep3rHelperParameters, Keep3rHelperParameters__factory } from '@types';
import { behaviours } from '@utils';
import { toUnit } from '@utils/bn';
import { generateRandomAddress } from '@utils/wallet';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import IUniswapV3PoolArtifact from 'node_modules/@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';

describe('Keep3rHelperParameters', () => {
  let governance: SignerWithAddress;
  let parametersFactory: Keep3rHelperParameters__factory;
  let parameters: Keep3rHelperParameters;
  let pool: FakeContract<IUniswapV3Pool>;

  before(async () => {
    [, governance] = await ethers.getSigners();

    parametersFactory = (await ethers.getContractFactory('Keep3rHelperParameters')) as Keep3rHelperParameters__factory;
    pool = await smock.fake(IUniswapV3PoolArtifact);
  });

  beforeEach(() => {
    pool.token0.returns(KP3R_V1_ADDRESS);
  });

  context('constructor', () => {
    const randomKeep3rV2Address = generateRandomAddress();

    it('should assign keep3rV2 to given parameter', async () => {
      parameters = await parametersFactory.deploy(randomKeep3rV2Address, governance.address, pool.address);
      expect(await parameters.callStatic.keep3rV2()).to.equal(randomKeep3rV2Address);
    });

    it('should assign kp3rWethPool address', async () => {
      parameters = await parametersFactory.deploy(randomKeep3rV2Address, governance.address, pool.address);
      const assignedAddress = (await parameters.callStatic.kp3rWethPool()).poolAddress;
      expect(assignedAddress).to.equal(pool.address);
    });

    it('should set kp3rWethPool isTKNToken0 to true if KP3R is token0', async () => {
      parameters = await parametersFactory.deploy(randomKeep3rV2Address, governance.address, pool.address);
      const isTKNToken0 = (await parameters.callStatic.kp3rWethPool()).isTKNToken0;
      expect(isTKNToken0).to.be.true;
    });

    it('should set kp3rWethPool isTKNToken0 to false if KP3R is not token0', async () => {
      pool.token0.returns(generateRandomAddress());
      pool.token1.returns(KP3R_V1_ADDRESS);
      parameters = await parametersFactory.deploy(randomKeep3rV2Address, governance.address, pool.address);
      const isTKNToken0 = (await parameters.callStatic.kp3rWethPool()).isTKNToken0;
      expect(isTKNToken0).to.be.false;
    });
  });

  context('setKp3rWethPool', () => {
    let otherPool: FakeContract<IUniswapV3Pool>;

    before(async () => {
      otherPool = await smock.fake(IUniswapV3PoolArtifact);
    });

    beforeEach(async () => {
      parameters = await parametersFactory.deploy(generateRandomAddress(), governance.address, pool.address);
      otherPool.token0.returns(KP3R_V1_ADDRESS);
    });

    behaviours.onlyGovernance(
      () => parameters,
      'setKp3rWethPool',
      governance,
      () => [otherPool.address]
    );

    it('should set kp3rWethPool isTKNToken0 to true if KP3R is token0', async () => {
      await parameters.connect(governance).setKp3rWethPool(otherPool.address);
      const isTKNToken0 = (await parameters.callStatic.kp3rWethPool()).isTKNToken0;
      expect(isTKNToken0).to.be.true;
    });

    it('should set kp3rWethPool isTKNToken0 to false if KP3R is not token0', async () => {
      otherPool.token0.returns(generateRandomAddress());
      otherPool.token1.returns(KP3R_V1_ADDRESS);

      await parameters.connect(governance).setKp3rWethPool(otherPool.address);
      const isTKNToken0 = (await parameters.callStatic.kp3rWethPool()).isTKNToken0;
      expect(isTKNToken0).to.be.false;
    });

    it('should revert if pool does not contain KP3R as token0 nor token1', async () => {
      otherPool.token0.returns(generateRandomAddress());
      otherPool.token1.returns(generateRandomAddress());

      await expect(parameters.connect(governance).setKp3rWethPool(otherPool.address)).to.be.revertedWith('InvalidOraclePool()');
    });

    it('should emit event', async () => {
      await expect(parameters.connect(governance).setKp3rWethPool(otherPool.address))
        .to.emit(parameters, 'Kp3rWethPoolChange')
        .withArgs(otherPool.address, true);
    });
  });

  context('basic setters', () => {
    const randomKeep3rV2Address = generateRandomAddress();

    beforeEach(async () => {
      parameters = await parametersFactory.deploy(generateRandomAddress(), governance.address, pool.address);
    });

    [
      { name: 'setMinBoost', parameter: 'minBoost', args: () => [toUnit(1)], event: 'MinBoostChange' },
      { name: 'setMaxBoost', parameter: 'maxBoost', args: () => [toUnit(1)], event: 'MaxBoostChange' },
      { name: 'setTargetBond', parameter: 'targetBond', args: () => [toUnit(1)], event: 'TargetBondChange' },
      { name: 'setKeep3rV2', parameter: 'keep3rV2', args: () => [randomKeep3rV2Address], event: 'Keep3rV2Change' },
      { name: 'setWorkExtraGas', parameter: 'workExtraGas', args: () => [toUnit(1)], event: 'WorkExtraGasChange' },
      { name: 'setQuoteTwapTime', parameter: 'quoteTwapTime', args: () => [60], event: 'QuoteTwapTimeChange' },
      { name: 'setMinBaseFee', parameter: 'minBaseFee', args: () => [10e9], event: 'MinBaseFeeChange' },
    ].forEach((method) => {
      describe(method.name, () => {
        behaviours.onlyGovernance(() => parameters, method.name, governance, method.args);

        it('should assign specified value to variable', async () => {
          expect(await (parameters as Contract)[method.parameter]()).not.to.be.equal(method.args()[0]);
          await (parameters as Contract).connect(governance)[method.name](...method.args());
          expect(await (parameters as Contract)[method.parameter]()).to.be.equal(method.args()[0]);
        });

        it('should emit event', async () => {
          await expect((parameters as Contract).connect(governance)[method.name](...method.args()))
            .to.emit(parameters, method.event)
            .withArgs(...method.args());
        });
      });
    });
  });
});
