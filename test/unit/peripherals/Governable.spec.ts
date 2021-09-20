import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GovernableForTest, GovernableForTest__factory } from '@types';
import { behaviours, wallet } from '@utils';
import { ZERO_ADDRESS } from '@utils/constants';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Governable', () => {
  let governance: SignerWithAddress;
  let pendingGovernance: SignerWithAddress;
  let governableFactory: MockContractFactory<GovernableForTest__factory>;

  const randomAddress = wallet.generateRandomAddress();

  before(async () => {
    [, governance, pendingGovernance] = await ethers.getSigners();
    governableFactory = await smock.mock<GovernableForTest__factory>('GovernableForTest');
  });

  describe('constructor', () => {
    it('should revert when given zero address', async () => {
      await expect(governableFactory.deploy(ZERO_ADDRESS)).to.be.revertedWith('NoGovernanceZeroAddress()');
    });
  });

  context('after deployed', () => {
    let governable: MockContract<GovernableForTest>;

    beforeEach(async () => {
      governable = await governableFactory.deploy(governance.address);
    });

    describe('setGovernance', () => {
      behaviours.onlyGovernance(() => governable, 'setGovernance', governance, [randomAddress]);

      it('should set pendingGovernance', async () => {
        await governable.connect(governance).setGovernance(randomAddress);
        expect(await governable.pendingGovernance()).to.be.eq(randomAddress);
      });

      it('should emit event', async () => {
        const tx = await governable.connect(governance).setGovernance(randomAddress);
        expect(tx).to.emit(governable, 'GovernanceProposal').withArgs(randomAddress);
      });
    });

    describe('acceptGovernance', () => {
      beforeEach(async () => {
        await governable.setVariable('pendingGovernance', pendingGovernance.address);
      });

      behaviours.onlyPendingGovernance(() => governable, 'acceptGovernance', pendingGovernance, []);

      it('should set governance', async () => {
        await governable.connect(pendingGovernance).acceptGovernance();
        expect(await governable.governance()).to.be.eq(pendingGovernance.address);
      });

      it('should remove pending governance', async () => {
        await governable.connect(pendingGovernance).acceptGovernance();
        expect(await governable.pendingGovernance()).to.be.eq(ZERO_ADDRESS);
      });

      it('should emit event', async () => {
        const tx = await governable.connect(pendingGovernance).acceptGovernance();
        expect(tx).to.emit(governable, 'GovernanceSet').withArgs(pendingGovernance.address);
      });
    });
  });
});
