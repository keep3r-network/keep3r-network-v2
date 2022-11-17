import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rJobOwnershipForTest, Keep3rJobOwnershipForTest__factory } from '@types';
import { evm, wallet } from '@utils';
import { onlyJobOwner } from '@utils/behaviours';
import { ZERO_ADDRESS } from '@utils/constants';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Keep3rJobOwnership', () => {
  const jobAddress = wallet.generateRandomAddress();
  let jobOwnership: MockContract<Keep3rJobOwnershipForTest>;
  let owner: SignerWithAddress;
  let jobOwnershipFactory: MockContractFactory<Keep3rJobOwnershipForTest__factory>;

  let snapshotId: string;

  before(async () => {
    [owner] = await ethers.getSigners();
    jobOwnershipFactory = await smock.mock<Keep3rJobOwnershipForTest__factory>('Keep3rJobOwnershipForTest');

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);

    jobOwnership = await jobOwnershipFactory.deploy();
    await jobOwnership.setVariable('jobOwner', {
      [jobAddress]: owner.address,
    });
  });

  describe('changeJobOwnership', () => {
    let notOwner: SignerWithAddress;

    beforeEach(async () => {
      [, notOwner] = await ethers.getSigners();
    });

    onlyJobOwner(
      () => jobOwnership,
      'changeJobOwnership',
      owner,
      () => [jobAddress, notOwner.address]
    );

    it('should set the new owner as pending', async () => {
      await jobOwnership.connect(owner).changeJobOwnership(jobAddress, notOwner.address);
      expect(await jobOwnership.jobPendingOwner(jobAddress)).to.equal(notOwner.address);
    });

    it('should emit event', async () => {
      await expect(jobOwnership.connect(owner).changeJobOwnership(jobAddress, notOwner.address))
        .to.emit(jobOwnership, 'JobOwnershipChange')
        .withArgs(jobAddress, owner.address, notOwner.address);
    });
  });

  describe('acceptJobOwnership', () => {
    let pendingOwner: SignerWithAddress;
    let notPendingOwner: SignerWithAddress;

    beforeEach(async () => {
      [, pendingOwner, notPendingOwner] = await ethers.getSigners();
      await jobOwnership.setVariable('jobPendingOwner', {
        [jobAddress]: pendingOwner.address,
      });
    });

    it('should be callable by pending job owner', async () => {
      await expect(jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress)).not.to.be.reverted;
    });

    it('should not be callable by any address', async () => {
      await expect(jobOwnership.connect(notPendingOwner).acceptJobOwnership(jobAddress)).to.be.revertedWith('OnlyPendingJobOwner()');
    });

    it('should set the pending owner as the job owner', async () => {
      await jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress);
      expect(await jobOwnership.jobOwner(jobAddress)).to.equal(pendingOwner.address);
    });

    it('should delete the job pending owner entry', async () => {
      await jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress);
      expect(await jobOwnership.jobPendingOwner(jobAddress)).to.equal(ZERO_ADDRESS);
    });

    it('should emit event', async () => {
      await expect(jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress))
        .to.emit(jobOwnership, 'JobOwnershipAssent')
        .withArgs(pendingOwner.address, jobAddress, owner.address);
    });
  });
});
