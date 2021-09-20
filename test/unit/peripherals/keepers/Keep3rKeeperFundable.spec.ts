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
  IUniswapV3Pool,
  Keep3rHelper,
  Keep3rKeeperFundableForTest,
  Keep3rKeeperFundableForTest__factory,
  Keep3rLibrary,
} from '@types';
import { toUnit } from '@utils/bn';
import chai, { expect } from 'chai';
import { BigNumber, Event } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';

chai.use(smock.matchers);

describe('Keep3rKeeperFundable', () => {
  let randomKeeper: SignerWithAddress;
  let keeperFundable: MockContract<Keep3rKeeperFundableForTest>;
  let helper: FakeContract<Keep3rHelper>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keeperFundableFactory: MockContractFactory<Keep3rKeeperFundableForTest__factory>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let erc20: FakeContract<ERC20>;
  let oraclePool: FakeContract<IUniswapV3Pool>;
  let library: Keep3rLibrary;

  const bondTime = moment.duration(3, 'days').as('seconds');

  before(async () => {
    [, randomKeeper] = await ethers.getSigners();
    library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as any as Keep3rLibrary;
    keeperFundableFactory = await smock.mock<Keep3rKeeperFundableForTest__factory>('Keep3rKeeperFundableForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
  });

  beforeEach(async () => {
    helper = await smock.fake(IKeep3rHelperArtifact);
    erc20 = await smock.fake(ERC20Artifact);
    keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token0.returns(keep3rV1.address);

    keeperFundable = await keeperFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
  });

  describe('bond', () => {
    beforeEach(async () => {
      erc20.transferFrom.returns(true);
    });

    it('should revert if keeper is disputed', async () => {
      await keeperFundable.setVariable('disputes', { [randomKeeper.address]: true });
      await expect(keeperFundable.connect(randomKeeper).bond(erc20.address, toUnit(1))).to.be.revertedWith('Disputed()');
    });

    it('should revert if caller is already a job', async () => {
      await keeperFundable.setJob(randomKeeper.address);
      await expect(keeperFundable.connect(randomKeeper).bond(erc20.address, toUnit(1))).to.be.revertedWith('AlreadyAJob()');
    });

    it('should emit event', async () => {
      erc20.balanceOf.returnsAtCall(0, toUnit(0));
      erc20.balanceOf.returnsAtCall(1, toUnit(1));

      const receipt = await (await keeperFundable.connect(randomKeeper).bond(erc20.address, toUnit(1))).wait();
      const event = (receipt.events as Event[])[0];
      const lastBlock = await ethers.provider.getBlock('latest');

      expect(event.args).to.deep.equal([
        randomKeeper.address,
        BigNumber.from(lastBlock.number),
        BigNumber.from(lastBlock.timestamp + bondTime),
        toUnit(1),
      ]);
    });
  });

  describe('unbond', () => {
    const bondedAmount = toUnit(1);

    beforeEach(async () => {
      await keeperFundable.setVariable('bonds', {
        [randomKeeper.address]: {
          [erc20.address]: bondedAmount,
          [keep3rV1.address]: bondedAmount,
        },
      });
    });

    it('should register the unblock timestamp', async () => {
      const unbondTime = await keeperFundable.callStatic.unbondTime();
      await keeperFundable.connect(randomKeeper).unbond(erc20.address, toUnit(1));
      const unbondBlockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

      const canWithdrawAfter = await keeperFundable.canWithdrawAfter(randomKeeper.address, erc20.address);
      expect(canWithdrawAfter).to.equal(unbondTime.add(unbondBlockTimestamp));
    });

    it('should reduce amount from bonds', async () => {
      const toUnbondAmount = toUnit(0.1);
      await keeperFundable.connect(randomKeeper).unbond(erc20.address, toUnbondAmount);

      const remaining = await keeperFundable.bonds(randomKeeper.address, erc20.address);
      expect(remaining).to.equal(bondedAmount.sub(toUnbondAmount));
    });

    it('should add to the current pending unbond amount', async () => {
      const initialpendingUnbonds = toUnit(2);
      const toUnbondAmount = toUnit(1);

      await keeperFundable.setVariable('pendingUnbonds', {
        [randomKeeper.address]: {
          [erc20.address]: initialpendingUnbonds,
        },
      });

      await keeperFundable.connect(randomKeeper).unbond(erc20.address, toUnbondAmount);
      const pendingUnbonds = await keeperFundable.pendingUnbonds(randomKeeper.address, erc20.address);
      expect(pendingUnbonds).to.equal(initialpendingUnbonds.add(toUnbondAmount));
    });

    it('should emit event', async () => {
      const tx = await keeperFundable.connect(randomKeeper).unbond(erc20.address, toUnit(0.1));
      const unbondBlockNumber = (await ethers.provider.getBlock('latest')).number;

      const canWithdrawAfter = await keeperFundable.callStatic.canWithdrawAfter(randomKeeper.address, erc20.address);

      expect(tx).to.emit(keeperFundable, 'Unbonding').withArgs(randomKeeper.address, unbondBlockNumber, canWithdrawAfter, toUnit(0.1));
    });
  });

  describe('activate', () => {
    it('should revert to a disputed keeper', async () => {
      await keeperFundable.setVariable('disputes', { [randomKeeper.address]: true });
      await expect(keeperFundable.connect(randomKeeper).activate(erc20.address)).to.be.revertedWith('Disputed');
    });

    it('should revert if bondings are unexistent', async () => {
      await expect(keeperFundable.connect(randomKeeper).activate(erc20.address)).to.be.revertedWith('BondsUnexistent');
    });

    it('should revert if bondings are blocked', async () => {
      const lastBlock = await ethers.provider.getBlock('latest');
      await keeperFundable.setVariable('canActivateAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp + 10 } });

      await expect(keeperFundable.connect(randomKeeper).activate(erc20.address)).to.be.revertedWith('BondsLocked');
    });

    context('when activating any ERC20', () => {
      beforeEach(async () => {
        const lastBlock = await ethers.provider.getBlock('latest');
        await keeperFundable.setVariable('canActivateAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } });
        await keeperFundable.setVariable('pendingBonds', { [randomKeeper.address]: { [erc20.address]: toUnit(1) } });
      });
      it('should add the keeper', async () => {
        await keeperFundable.connect(randomKeeper).activate(erc20.address);
        expect(await keeperFundable.isKeeper(randomKeeper.address)).to.be.true;
      });
      it('should reset pending bonds for that token', async () => {
        expect(await keeperFundable.pendingBonds(randomKeeper.address, erc20.address)).to.be.eq(toUnit(1));
        await keeperFundable.connect(randomKeeper).activate(erc20.address);
        expect(await keeperFundable.pendingBonds(randomKeeper.address, erc20.address)).to.be.eq(0);
      });
      it('should add pending bonds to keeper accountance', async () => {
        expect(await keeperFundable.bonds(randomKeeper.address, erc20.address)).to.be.eq(0);
        await keeperFundable.connect(randomKeeper).activate(erc20.address);
        expect(await keeperFundable.bonds(randomKeeper.address, erc20.address)).to.be.eq(toUnit(1));
      });
      it('should emit event', async () => {
        const tx = await keeperFundable.connect(randomKeeper).activate(erc20.address);
        const block = await ethers.provider.getBlock('latest');

        await expect(tx).to.emit(keeperFundable, 'Activation').withArgs(randomKeeper.address, block.number, block.timestamp, toUnit(1));
      });
    });

    context('when activating KP3R', () => {
      beforeEach(async () => {
        const lastBlock = await ethers.provider.getBlock('latest');
        await keeperFundable.setVariable('canActivateAfter', { [randomKeeper.address]: { [keep3rV1.address]: lastBlock.timestamp } });
        await keeperFundable.setVariable('pendingBonds', { [randomKeeper.address]: { [keep3rV1.address]: toUnit(1) } });
      });

      it('should burn bonded KP3Rs', async () => {
        await keeperFundable.connect(randomKeeper).activate(keep3rV1.address);
        expect(keep3rV1.burn).to.have.been.calledWith(toUnit(1));
      });
    });
  });

  describe('withdraw', () => {
    it('should revert if bondings are unexistent', async () => {
      await expect(keeperFundable.connect(randomKeeper).withdraw(erc20.address)).to.be.revertedWith('UnbondsUnexistent');
    });

    it('should revert if bondings are blocked', async () => {
      const lastBlock = await ethers.provider.getBlock('latest');
      await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp + 1 } });

      await expect(keeperFundable.connect(randomKeeper).withdraw(erc20.address)).to.be.revertedWith('UnbondsLocked');
    });
    it('should revert to a disputed keeper', async () => {
      const lastBlock = await ethers.provider.getBlock('latest');
      await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } });

      await keeperFundable.setVariable('disputes', { [randomKeeper.address]: true });
      await expect(keeperFundable.connect(randomKeeper).withdraw(erc20.address)).to.be.revertedWith('Disputed');
    });

    context('when withdrawing any ERC20', () => {
      beforeEach(async () => {
        const lastBlock = await ethers.provider.getBlock('latest');
        await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } });
        await keeperFundable.setVariable('pendingUnbonds', { [randomKeeper.address]: { [erc20.address]: toUnit(1) } });

        erc20.transfer.returns(true);
      });
      it('should transfer the unbonded amount to the keeper', async () => {
        await keeperFundable.connect(randomKeeper).withdraw(erc20.address);
        expect(erc20.transfer).to.have.been.calledWith(randomKeeper.address, toUnit(1));
      });
      it('should reset the unbondigs', async () => {
        await keeperFundable.connect(randomKeeper).withdraw(erc20.address);
        expect(await keeperFundable.pendingUnbonds(randomKeeper.address, erc20.address)).to.be.eq(0);
      });
      it('should emit event', async () => {
        const tx = await keeperFundable.connect(randomKeeper).withdraw(erc20.address);

        await expect(tx).to.emit(keeperFundable, 'Withdrawal').withArgs(randomKeeper.address, erc20.address, toUnit(1));
      });
    });

    context('when withdrawing KP3R', () => {
      beforeEach(async () => {
        const lastBlock = await ethers.provider.getBlock('latest');
        await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [keep3rV1.address]: lastBlock.timestamp } });
        await keeperFundable.setVariable('pendingUnbonds', { [randomKeeper.address]: { [keep3rV1.address]: toUnit(1) } });

        keep3rV1.transfer.returns(true);
      });
      it('should mint withdrawn KP3Rs', async () => {
        await keeperFundable.connect(randomKeeper).withdraw(keep3rV1.address);
        expect(keep3rV1Proxy['mint(uint256)']).to.have.been.calledWith(toUnit(1));
      });
    });
  });
});
