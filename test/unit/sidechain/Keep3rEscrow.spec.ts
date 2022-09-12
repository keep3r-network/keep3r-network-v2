import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IERC20, Keep3rEscrow, Keep3rEscrow__factory } from '@types';
import { wallet } from '@utils';
import { onlyGovernance, onlyMinter } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Keep3rEscrow', () => {
  let governance: SignerWithAddress;
  let minter: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let escrowFactory: MockContractFactory<Keep3rEscrow__factory>;
  let escrow: MockContract<Keep3rEscrow>;
  let wKP3R: FakeContract<IERC20>;

  const oneToken = toUnit(1);

  before(async () => {
    [, governance, minter, randomUser] = await ethers.getSigners();
    wKP3R = await smock.fake('IERC20');
    escrowFactory = await smock.mock<Keep3rEscrow__factory>('Keep3rEscrow');
  });

  beforeEach(async () => {
    escrow = await escrowFactory.deploy(governance.address, wKP3R.address);
    await escrow.connect(governance).setMinter(minter.address);
  });

  context('constructor', () => {
    it('should set governance to the deployer address', async () => {
      expect(await escrow.governance()).to.equal(governance.address);
    });

    it('should set wKP3R to the right address', async () => {
      expect(await escrow.wKP3R()).to.equal(wKP3R.address);
    });
  });

  context('deposit', () => {
    beforeEach(async () => {
      wKP3R.balanceOf.whenCalledWith(randomUser.address).returns(oneToken);
      wKP3R.transferFrom.whenCalledWith(randomUser.address, escrow.address, oneToken).returns(true);
    });

    it('should call wKP3Rs transferFrom with the correct arguments', async () => {
      await escrow.connect(randomUser).deposit(oneToken);
      expect(wKP3R.transferFrom).to.have.been.calledWith(randomUser.address, escrow.address, oneToken);
    });

    it('should emit an event', async () => {
      expect(await escrow.connect(randomUser).deposit(oneToken))
        .to.emit(escrow, 'wKP3RDeposited')
        .withArgs(wKP3R.address, randomUser.address, oneToken);
    });
  });

  context('mint', () => {
    beforeEach(async () => {
      await escrow.connect(governance).setWKP3R(wKP3R.address);
      wKP3R.balanceOf.whenCalledWith(escrow.address).returns(oneToken);
      wKP3R.transfer.whenCalledWith(minter.address, oneToken).returns(true);
    });

    onlyMinter(
      () => escrow,
      'mint',
      minter,
      () => [oneToken]
    );

    it('should call wKP3Rs transferFrom with the correct arguments', async () => {
      await escrow.connect(minter).mint(oneToken);
      expect(wKP3R.transfer).to.have.been.calledWith(minter.address, oneToken);
    });

    it('should emit an event', async () => {
      expect(await escrow.connect(minter).mint(oneToken))
        .to.emit(escrow, 'wKP3RMinted')
        .withArgs(wKP3R.address, minter.address, oneToken);
    });
  });

  context('setWKP3R', () => {
    const randomAddress = wallet.generateRandomAddress();
    onlyGovernance(
      () => escrow,
      'setWKP3R',
      governance,
      () => [randomAddress]
    );

    it('should set wKP3R to a new address', async () => {
      await escrow.connect(governance).setWKP3R(randomAddress);
      expect(await escrow.wKP3R()).to.eq(randomAddress);
    });

    it('should emit an event', async () => {
      expect(await escrow.connect(governance).setWKP3R(randomAddress))
        .to.emit(escrow, 'wKP3RSet')
        .withArgs(randomAddress);
    });
  });
});
