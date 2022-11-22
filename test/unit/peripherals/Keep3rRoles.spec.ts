import { MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Keep3rRoles, Keep3rRoles__factory } from '@types';
import { behaviours, wallet } from '@utils';
import { ZERO_ADDRESS } from '@utils/constants';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rRoles', () => {
  let roles: MockContract<Keep3rRoles>;
  let governance: SignerWithAddress;
  let rolesFactory: MockContractFactory<Keep3rRoles__factory>;

  const randomAddress = wallet.generateRandomAddress();

  before(async () => {
    rolesFactory = await smock.mock<Keep3rRoles__factory>('Keep3rRoles');
    [, governance] = await ethers.getSigners();
  });

  beforeEach(async () => {
    roles = await rolesFactory.deploy(governance.address);
  });

  describe('addSlasher', () => {
    behaviours.onlyGovernance(() => roles, 'addSlasher', governance, [randomAddress]);

    it('should revert if slasher is address 0', async () => {
      await expect(roles.connect(governance).addSlasher(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should revert if slasher already added', async () => {
      await roles.setVariable('slashers', { [randomAddress]: true });
      await expect(roles.connect(governance).addSlasher(randomAddress)).to.be.revertedWith('SlasherExistent()');
    });

    it('should add the slasher', async () => {
      await roles.connect(governance).addSlasher(randomAddress);
      expect(await roles.slashers(randomAddress)).to.be.true;
    });

    it('should emit event', async () => {
      const tx = await roles.connect(governance).addSlasher(randomAddress);
      await expect(tx).to.emit(roles, 'SlasherAdded').withArgs(randomAddress);
    });
  });

  describe('removeSlasher', () => {
    behaviours.onlyGovernance(() => roles, 'removeSlasher', governance, [randomAddress]);

    it('should revert if slasher not added', async () => {
      await expect(roles.connect(governance).removeSlasher(randomAddress)).to.be.revertedWith('SlasherUnexistent()');
    });

    it('should remove the slasher', async () => {
      await roles.setVariable('slashers', { [randomAddress]: true });
      await roles.connect(governance).removeSlasher(randomAddress);
      expect(await roles.slashers(randomAddress)).to.be.false;
    });

    it('should emit event', async () => {
      await roles.setVariable('slashers', { [randomAddress]: true });
      const tx = await roles.connect(governance).removeSlasher(randomAddress);
      await expect(tx).to.emit(roles, 'SlasherRemoved').withArgs(randomAddress);
    });
  });

  describe('addDisputer', () => {
    behaviours.onlyGovernance(() => roles, 'addDisputer', governance, [randomAddress]);

    it('should revert if disputer is address 0', async () => {
      await expect(roles.connect(governance).addDisputer(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should revert if disputer already added', async () => {
      await roles.setVariable('disputers', { [randomAddress]: true });
      await expect(roles.connect(governance).addDisputer(randomAddress)).to.be.revertedWith('DisputerExistent()');
    });

    it('should add the disputer', async () => {
      await roles.connect(governance).addDisputer(randomAddress);
      expect(await roles.disputers(randomAddress)).to.be.true;
    });

    it('should emit event', async () => {
      const tx = await roles.connect(governance).addDisputer(randomAddress);
      await expect(tx).to.emit(roles, 'DisputerAdded').withArgs(randomAddress);
    });
  });

  describe('removeDisputer', () => {
    behaviours.onlyGovernance(() => roles, 'removeDisputer', governance, [randomAddress]);

    it('should revert if disputer not added', async () => {
      await expect(roles.connect(governance).removeSlasher(randomAddress)).to.be.revertedWith('SlasherUnexistent()');
    });

    it('should remove the disputer', async () => {
      await roles.setVariable('disputers', { [randomAddress]: true });
      await roles.connect(governance).removeDisputer(randomAddress);
      expect(await roles.slashers(randomAddress)).to.be.false;
    });

    it('should emit event', async () => {
      await roles.setVariable('disputers', { [randomAddress]: true });
      const tx = await roles.connect(governance).removeDisputer(randomAddress);
      await expect(tx).to.emit(roles, 'DisputerRemoved').withArgs(randomAddress);
    });
  });
});
