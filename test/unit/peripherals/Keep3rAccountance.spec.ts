import { Keep3rAccountanceForTest, Keep3rAccountanceForTest__factory } from '@types';
import { wallet } from '@utils';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Keep3rAccountance', () => {
  let accountance: Keep3rAccountanceForTest;
  let accountanceFactory: Keep3rAccountanceForTest__factory;
  const randomAddr1 = wallet.generateRandomAddress();
  const randomAddr2 = wallet.generateRandomAddress();

  before(async () => {
    accountanceFactory = (await ethers.getContractFactory('Keep3rAccountanceForTest')) as Keep3rAccountanceForTest__factory;
  });

  beforeEach(async () => {
    accountance = await accountanceFactory.deploy();
  });

  describe('jobs', () => {
    it('should return full list', async () => {
      accountance.setJob(randomAddr1);
      accountance.setJob(randomAddr2);

      expect(await accountance.jobs()).to.deep.equal([randomAddr1, randomAddr2]);
    });

    it('should not store duplicates', async () => {
      accountance.setJob(randomAddr1);
      accountance.setJob(randomAddr2);
      accountance.setJob(randomAddr2);

      expect(await accountance.jobs()).to.deep.equal([randomAddr1, randomAddr2]);
    });
  });

  describe('keepers', () => {
    it('should return full list', async () => {
      accountance.addKeeper(randomAddr1);
      accountance.addKeeper(randomAddr2);

      expect(await accountance.keepers()).to.deep.equal([randomAddr1, randomAddr2]);
    });

    it('should not store duplicates', async () => {
      accountance.addKeeper(randomAddr1);
      accountance.addKeeper(randomAddr2);
      accountance.addKeeper(randomAddr2);

      expect(await accountance.keepers()).to.deep.equal([randomAddr1, randomAddr2]);
    });
  });
});
