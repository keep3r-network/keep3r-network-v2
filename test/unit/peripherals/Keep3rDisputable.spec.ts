import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rDisputableForTest, Keep3rDisputableForTest__factory } from '@types';
import { wallet } from '@utils';
import { onlyDisputer } from '@utils/behaviours';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rDisputable', () => {
  const job = wallet.generateRandomAddress();
  let disputer: SignerWithAddress;
  let disputable: MockContract<Keep3rDisputableForTest>;
  let disputableFactory: MockContractFactory<Keep3rDisputableForTest__factory>;

  before(async () => {
    [, disputer] = await ethers.getSigners();
    disputableFactory = await smock.mock('Keep3rDisputableForTest');
  });

  beforeEach(async () => {
    disputable = await disputableFactory.deploy();
    await disputable.setVariable('disputers', { [disputer.address]: true });
  });

  describe('dispute', () => {
    onlyDisputer(
      () => disputable,
      'dispute',
      () => [disputer],
      [job]
    );

    it('should revert if job was already disputed', async () => {
      await disputable.connect(disputer).dispute(job);
      await expect(disputable.connect(disputer).dispute(job)).to.be.revertedWith('AlreadyDisputed()');
    });

    it('should create a job dispute', async () => {
      await disputable.connect(disputer).dispute(job);
      expect(await disputable.connect(disputer).disputes(job)).to.be.true;
    });

    it('should emit event', async () => {
      await expect(disputable.connect(disputer).dispute(job)).to.emit(disputable, 'Dispute').withArgs(job, disputer.address);
    });
  });

  describe('resolve', () => {
    onlyDisputer(
      () => disputable,
      'resolve',
      () => [disputer],
      [job]
    );

    it('should revert if job was not disputed', async () => {
      await expect(disputable.connect(disputer).resolve(job)).to.be.revertedWith('NotDisputed()');
    });

    context('when job is disputed', () => {
      beforeEach(async () => {
        await disputable.setVariable('disputes', { [job]: true });
      });

      it('should resolve job dispute', async () => {
        await disputable.connect(disputer).resolve(job);
        expect(await disputable.connect(disputer).disputes(job)).to.be.false;
      });

      it('should emit event', async () => {
        await expect(disputable.connect(disputer).resolve(job)).to.emit(disputable, 'Resolve').withArgs(job, disputer.address);
      });
    });
  });
});
