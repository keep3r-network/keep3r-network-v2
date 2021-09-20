import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rDisputableForTest, Keep3rDisputableForTest__factory } from '@types';
import { wallet } from '@utils';
import { onlyDisputerOrGovernance } from '@utils/behaviours';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rDisputable', () => {
  const job = wallet.generateRandomAddress();
  let governance: SignerWithAddress;
  let disputer: SignerWithAddress;
  let disputable: MockContract<Keep3rDisputableForTest>;
  let disputableFactory: MockContractFactory<Keep3rDisputableForTest__factory>;

  before(async () => {
    [governance, disputer] = await ethers.getSigners();
    disputableFactory = await smock.mock('Keep3rDisputableForTest');
  });

  beforeEach(async () => {
    disputable = await disputableFactory.deploy();
    await disputable.setVariable('disputers', { [disputer.address]: true });
  });

  describe('dispute', () => {
    onlyDisputerOrGovernance(
      () => disputable,
      'dispute',
      () => [disputer, governance],
      [job]
    );

    it('should revert if job was already disputed', async () => {
      await disputable.dispute(job);
      await expect(disputable.dispute(job)).to.be.revertedWith('AlreadyDisputed()');
    });

    it('should create a job dispute', async () => {
      await disputable.dispute(job);
      expect(await disputable.disputes(job)).to.be.true;
    });

    it('should emit event', async () => {
      await expect(disputable.dispute(job)).to.emit(disputable, 'Dispute').withArgs(job);
    });
  });

  describe('resolve', () => {
    onlyDisputerOrGovernance(
      () => disputable,
      'resolve',
      () => [disputer, governance],
      [job]
    );

    it('should revert if job was not disputed', async () => {
      await expect(disputable.resolve(job)).to.be.revertedWith('NotDisputed()');
    });

    context('when job is disputed', () => {
      beforeEach(async () => {
        await disputable.setVariable('disputes', { [job]: true });
      });

      it('should resolve job dispute', async () => {
        await disputable.resolve(job);
        expect(await disputable.disputes(job)).to.be.false;
      });

      it('should emit event', async () => {
        await expect(disputable.resolve(job)).to.emit(disputable, 'Resolve').withArgs(job);
      });
    });
  });
});
