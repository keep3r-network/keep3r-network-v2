import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rRoles, Keep3rRoles__factory } from '@types';
import { wallet } from '@utils';
import { onlyGovernor } from '@utils/behaviours';
import { ZERO_ADDRESS } from '@utils/constants';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rRoles', () => {
  let roles: MockContract<Keep3rRoles>;
  let governor: SignerWithAddress;
  let rolesFactory: MockContractFactory<Keep3rRoles__factory>;

  const randomAddress = wallet.generateRandomAddress();

  before(async () => {
    rolesFactory = await smock.mock<Keep3rRoles__factory>('Keep3rRoles');
    [, governor] = await ethers.getSigners();
  });

  beforeEach(async () => {
    roles = await rolesFactory.deploy(governor.address);
  });

  describe('addSlasher', () => {
    onlyGovernor(() => roles, 'addSlasher', governor, [randomAddress]);

    it('should revert if slasher is address 0', async () => {
      await expect(roles.connect(governor).addSlasher(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should revert if slasher already added', async () => {
      await roles.setVariable('slashers', { [randomAddress]: true });
      await expect(roles.connect(governor).addSlasher(randomAddress)).to.be.revertedWith('SlasherExistent()');
    });

    it('should add the slasher', async () => {
      await roles.connect(governor).addSlasher(randomAddress);
      expect(await roles.slashers(randomAddress)).to.be.true;
    });

    it('should emit event', async () => {
      const tx = await roles.connect(governor).addSlasher(randomAddress);
      await expect(tx).to.emit(roles, 'SlasherAdded').withArgs(randomAddress);
    });
  });

  describe('removeSlasher', () => {
    onlyGovernor(() => roles, 'removeSlasher', governor, [randomAddress]);

    it('should revert if slasher not added', async () => {
      await expect(roles.connect(governor).removeSlasher(randomAddress)).to.be.revertedWith('SlasherUnexistent()');
    });

    it('should remove the slasher', async () => {
      await roles.setVariable('slashers', { [randomAddress]: true });
      await roles.connect(governor).removeSlasher(randomAddress);
      expect(await roles.slashers(randomAddress)).to.be.false;
    });

    it('should emit event', async () => {
      await roles.setVariable('slashers', { [randomAddress]: true });
      const tx = await roles.connect(governor).removeSlasher(randomAddress);
      await expect(tx).to.emit(roles, 'SlasherRemoved').withArgs(randomAddress);
    });
  });

  describe('addDisputer', () => {
    onlyGovernor(() => roles, 'addDisputer', governor, [randomAddress]);

    it('should revert if disputer is address 0', async () => {
      await expect(roles.connect(governor).addDisputer(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should revert if disputer already added', async () => {
      await roles.setVariable('disputers', { [randomAddress]: true });
      await expect(roles.connect(governor).addDisputer(randomAddress)).to.be.revertedWith('DisputerExistent()');
    });

    it('should add the disputer', async () => {
      await roles.connect(governor).addDisputer(randomAddress);
      expect(await roles.disputers(randomAddress)).to.be.true;
    });

    it('should emit event', async () => {
      const tx = await roles.connect(governor).addDisputer(randomAddress);
      await expect(tx).to.emit(roles, 'DisputerAdded').withArgs(randomAddress);
    });
  });

  describe('removeDisputer', () => {
    onlyGovernor(() => roles, 'removeDisputer', governor, [randomAddress]);

    it('should revert if disputer not added', async () => {
      await expect(roles.connect(governor).removeSlasher(randomAddress)).to.be.revertedWith('SlasherUnexistent()');
    });

    it('should remove the disputer', async () => {
      await roles.setVariable('disputers', { [randomAddress]: true });
      await roles.connect(governor).removeDisputer(randomAddress);
      expect(await roles.slashers(randomAddress)).to.be.false;
    });

    it('should emit event', async () => {
      await roles.setVariable('disputers', { [randomAddress]: true });
      const tx = await roles.connect(governor).removeDisputer(randomAddress);
      await expect(tx).to.emit(roles, 'DisputerRemoved').withArgs(randomAddress);
    });
  });
});
