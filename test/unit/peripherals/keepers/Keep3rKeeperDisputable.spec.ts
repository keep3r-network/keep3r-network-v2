import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  ERC20ForTest,
  ERC20ForTest__factory,
  IKeep3rV1,
  IKeep3rV1Proxy,
  IUniswapV3Pool,
  Keep3rHelper,
  Keep3rKeeperDisputableForTest,
  Keep3rKeeperDisputableForTest__factory,
} from '@types';
import { evm, wallet } from '@utils';
import { onlySlasher } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rKeeperDisputable', () => {
  const randomKeeper = wallet.generateRandomAddress();
  let governance: SignerWithAddress;
  let slasher: SignerWithAddress;
  let disputer: SignerWithAddress;
  let keeperDisputable: MockContract<Keep3rKeeperDisputableForTest>;
  let helper: FakeContract<Keep3rHelper>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let oraclePool: FakeContract<IUniswapV3Pool>;
  let keeperDisputableFactory: MockContractFactory<Keep3rKeeperDisputableForTest__factory>;

  let snapshotId: string;

  before(async () => {
    [governance, slasher, disputer] = await ethers.getSigners();

    keeperDisputableFactory = await smock.mock<Keep3rKeeperDisputableForTest__factory>('Keep3rKeeperDisputableForTest');
    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');
    oraclePool = await smock.fake('IUniswapV3Pool');
    oraclePool.token0.returns(keep3rV1.address);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);

    keeperDisputable = await keeperDisputableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address);
    await keeperDisputable.setVariable('slashers', { [slasher.address]: true });
    await keeperDisputable.setVariable('disputers', { [disputer.address]: true });
  });

  describe('slash', () => {
    const bondAmount = toUnit(3);
    const unbondAmount = toUnit(5);

    onlySlasher(
      () => keeperDisputable,
      'slash',
      [slasher],
      () => [randomKeeper, keeperDisputable.address, 1, 1]
    );

    beforeEach(async () => {
      keep3rV1.transfer.returns(true);
      keep3rV1.transferFrom.returns(true);

      await keeperDisputable.setVariable('bonds', {
        [randomKeeper]: { [keep3rV1.address]: bondAmount },
      });
      await keeperDisputable.setVariable('pendingUnbonds', {
        [randomKeeper]: { [keep3rV1.address]: unbondAmount },
      });

      await keeperDisputable.connect(disputer).dispute(randomKeeper);
    });

    it('should revert if keeper is not disputed', async () => {
      const undisputedKeeper = wallet.generateRandomAddress();
      await expect(keeperDisputable.connect(slasher).slash(undisputedKeeper, keep3rV1.address, toUnit(0.1), toUnit(0.1))).to.be.revertedWith(
        'NotDisputed()'
      );
    });

    it('should emit event', async () => {
      await expect(keeperDisputable.connect(slasher).slash(randomKeeper, keep3rV1.address, toUnit(0.1), toUnit(0.2)))
        .to.emit(keeperDisputable, 'KeeperSlash')
        .withArgs(randomKeeper, slasher.address, toUnit(0.1).add(toUnit(0.2)));
    });

    it('should slash specified bond amount', async () => {
      const slashBondAmount = toUnit(1);
      await keeperDisputable.connect(slasher).slash(randomKeeper, keep3rV1.address, slashBondAmount, 0);
      expect(await keeperDisputable.bonds(randomKeeper, keep3rV1.address)).to.equal(bondAmount.sub(slashBondAmount));
    });

    it('should slash specified unbond amount', async () => {
      const slashUnbondAmount = toUnit(1);
      await keeperDisputable.connect(slasher).slash(randomKeeper, keep3rV1.address, 0, slashUnbondAmount);
      expect(await keeperDisputable.pendingUnbonds(randomKeeper, keep3rV1.address)).to.equal(unbondAmount.sub(slashUnbondAmount));
    });
  });

  describe('revoke', () => {
    onlySlasher(() => keeperDisputable, 'revoke', [slasher], [randomKeeper]);

    beforeEach(async () => {
      await keeperDisputable.setKeeper(randomKeeper);
    });

    it('should revert if keeper was not disputed', async () => {
      await expect(keeperDisputable.connect(slasher).revoke(randomKeeper)).to.be.revertedWith('NotDisputed()');
    });

    context('when keeper was disputed', () => {
      beforeEach(async () => {
        await keeperDisputable.connect(disputer).dispute(randomKeeper);
      });

      it('should remove keeper', async () => {
        await keeperDisputable.connect(slasher).revoke(randomKeeper);
        expect(await keeperDisputable.isKeeper(randomKeeper)).to.equal(false);
      });

      it('should keep keeper disputed', async () => {
        await keeperDisputable.connect(slasher).revoke(randomKeeper);
        expect(await keeperDisputable.disputes(randomKeeper)).to.equal(true);
      });

      it('should emit event', async () => {
        await expect(keeperDisputable.connect(slasher).revoke(randomKeeper))
          .to.emit(keeperDisputable, 'KeeperRevoke')
          .withArgs(randomKeeper, slasher.address);
      });

      it('should slash all keeper KP3R bonds', async () => {
        await keeperDisputable.setVariable('bonds', {
          [randomKeeper]: { [keep3rV1.address]: toUnit(1) },
        });

        await keeperDisputable.connect(slasher).revoke(randomKeeper);

        expect(await keeperDisputable.bonds(randomKeeper, keep3rV1.address)).to.equal(toUnit(0));
      });
    });
  });

  describe('internal slash', () => {
    context('when using an ERC20 bond', () => {
      const bondAmount = toUnit(2);
      const unbondAmount = toUnit(5);
      let erc20Factory: MockContractFactory<ERC20ForTest__factory>;
      let erc20: MockContract<ERC20ForTest>;

      before(async () => {
        erc20Factory = await smock.mock<ERC20ForTest__factory>('ERC20ForTest');
      });

      beforeEach(async () => {
        erc20 = await erc20Factory.deploy('Sample', 'SMP', keeperDisputable.address, toUnit(2));
        await keeperDisputable.setVariable('bonds', {
          [randomKeeper]: { [erc20.address]: bondAmount },
        });
        await keeperDisputable.setVariable('pendingUnbonds', {
          [randomKeeper]: { [erc20.address]: unbondAmount },
        });

        erc20.transfer.returns(true);
      });

      it('should not revert if transfer fails', async () => {
        erc20.transfer.reverts();
        await expect(keeperDisputable.internalSlash(randomKeeper, erc20.address, toUnit(1), toUnit(1))).not.to.be.reverted;
      });

      it('should transfer both bond and pending unbond tokens to governance', async () => {
        await keeperDisputable.internalSlash(randomKeeper, erc20.address, bondAmount, unbondAmount);
        expect(erc20.transfer).to.be.calledOnceWith(governance.address, bondAmount.add(unbondAmount));
      });

      it('should reduce keeper bonds', async () => {
        const slashBondAmount = toUnit(1);
        await keeperDisputable.internalSlash(randomKeeper, erc20.address, slashBondAmount, 0);
        expect(await keeperDisputable.bonds(randomKeeper, erc20.address)).to.equal(bondAmount.sub(slashBondAmount));
      });

      it('should reduce keeper pending unbonds', async () => {
        const slashUnbondAmount = toUnit(1);
        await keeperDisputable.internalSlash(randomKeeper, erc20.address, 0, slashUnbondAmount);
        expect(await keeperDisputable.pendingUnbonds(randomKeeper, erc20.address)).to.equal(unbondAmount.sub(slashUnbondAmount));
      });
    });

    context('when using a KP3R bond', () => {
      const bondAmount = toUnit(2);
      const unbondAmount = toUnit(5);

      beforeEach(async () => {
        await keeperDisputable.setVariable('bonds', {
          [randomKeeper]: { [keep3rV1.address]: bondAmount },
        });
        await keeperDisputable.setVariable('pendingUnbonds', {
          [randomKeeper]: { [keep3rV1.address]: unbondAmount },
        });
      });

      it('should reduce keeper bonds', async () => {
        const slashBondAmount = toUnit(1);
        await keeperDisputable.internalSlash(randomKeeper, keep3rV1.address, slashBondAmount, 0);
        expect(await keeperDisputable.bonds(randomKeeper, keep3rV1.address)).to.equal(bondAmount.sub(slashBondAmount));
      });

      it('should reduce keeper pending unbonds', async () => {
        const slashUnbondAmount = toUnit(1);
        await keeperDisputable.internalSlash(randomKeeper, keep3rV1.address, 0, slashUnbondAmount);
        expect(await keeperDisputable.pendingUnbonds(randomKeeper, keep3rV1.address)).to.equal(unbondAmount.sub(slashUnbondAmount));
      });
    });

    it('should not remove the dispute from the keeper', async () => {
      await keeperDisputable.connect(disputer).dispute(randomKeeper);
      await keeperDisputable.internalSlash(randomKeeper, keep3rV1.address, 0, 0);
      expect(await keeperDisputable.disputes(randomKeeper)).to.equal(true);
    });
  });
});
