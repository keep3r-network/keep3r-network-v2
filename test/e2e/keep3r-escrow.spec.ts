import { JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IERC20, Keep3rEscrow, Keep3rEscrow__factory } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as common from './common';

const DAI_WETH_WHALE = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';

describe('@skip-on-coverage Keep3rEscrow', () => {
  let escrow: Keep3rEscrow;
  let escrowFactory: Keep3rEscrow__factory;
  let fakeWKP3R: IERC20;
  let governor: SignerWithAddress;
  let minter: SignerWithAddress;
  let snapshotId: string;
  let whale: JsonRpcSigner;
  let randomUser: SignerWithAddress;

  const oneToken = toUnit(1);

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    [, governor, minter, randomUser] = await ethers.getSigners();

    fakeWKP3R = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.DAI_ADDRESS)) as IERC20;

    escrowFactory = (await ethers.getContractFactory('Keep3rEscrow')) as Keep3rEscrow__factory;
    escrow = await escrowFactory.deploy(governor.address, fakeWKP3R.address);
    whale = await wallet.impersonate(DAI_WETH_WHALE);

    await escrow.connect(governor).setMinter(minter.address);
    await fakeWKP3R.connect(whale).approve(escrow.address, oneToken);

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  it('should transfer wKP3R to the contract when deposit is called', async () => {
    await escrow.connect(whale).deposit(oneToken);
    expect(await fakeWKP3R.balanceOf(escrow.address)).to.equal(oneToken);
  });

  context('when the contract doesnt have funds', () => {
    it('should revert if the minter tries to mint tokens', async () => {
      await expect(escrow.connect(minter).mint(oneToken)).to.be.revertedWith('Dai/insufficient-balance');
    });
  });

  context('when the contract has funds', () => {
    beforeEach(async () => {
      await escrow.connect(whale).deposit(oneToken);
    });

    it('should allow minter to mint tokens', async () => {
      await escrow.connect(minter).mint(oneToken);
      expect(await fakeWKP3R.balanceOf(minter.address)).to.equal(oneToken);
    });

    it('should not allow a random address to mint tokens', async () => {
      await expect(escrow.connect(randomUser).mint(oneToken)).to.be.revertedWith('OnlyMinter');
    });
  });

  it('should allow governor to withdraw any dust in the contract', async () => {
    await escrow.connect(whale).deposit(oneToken);
    await escrow.connect(governor).sendDust(fakeWKP3R.address, oneToken, governor.address);
    expect(await fakeWKP3R.balanceOf(governor.address)).to.equal(oneToken);
  });

  it('should only allow governor to withdraw dust in the contract', async () => {
    await escrow.connect(whale).deposit(oneToken);
    await expect(escrow.connect(randomUser).sendDust(fakeWKP3R.address, oneToken, governor.address)).to.be.revertedWith('OnlyGovernor()');
  });
});
