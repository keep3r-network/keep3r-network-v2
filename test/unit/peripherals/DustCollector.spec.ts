import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { BigNumber } from '@ethersproject/bignumber';
import { Wallet } from '@ethersproject/wallet';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DustCollectorForTest, DustCollectorForTest__factory, IERC20 } from '@types';
import { contracts, wallet } from '@utils';
import { onlyGovernance } from '@utils/behaviours';
import { toUnit } from '@utils/bn';
import { ETH_ADDRESS, ZERO_ADDRESS } from '@utils/constants';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { beforeEach } from 'mocha';

chai.use(smock.matchers);

describe('DustCollectorForTest', () => {
  let dust: MockContract<DustCollectorForTest>;
  let dustFactory: MockContractFactory<DustCollectorForTest__factory>;
  let governance: SignerWithAddress;
  let fakeERC20: FakeContract<IERC20>;
  let randomAddress = wallet.generateRandomAddress();
  let oneEth: BigNumber = toUnit(1);
  let tenTokens: BigNumber = toUnit(10);

  before(async () => {
    [, governance] = await ethers.getSigners();
    dustFactory = await smock.mock<DustCollectorForTest__factory>('DustCollectorForTest');
  });

  beforeEach(async () => {
    dust = await dustFactory.connect(governance).deploy();
    fakeERC20 = await smock.fake('IERC20');
    await contracts.setBalance(dust.address, tenTokens);
  });

  describe('sendDust', () => {
    onlyGovernance(
      () => dust,
      'sendDust',
      governance,
      () => [fakeERC20.address, tenTokens, randomAddress]
    );

    it('should revert if the receiver is the zero address', async () => {
      await expect(dust.sendDust(ETH_ADDRESS, oneEth, ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
    });

    it('should revert if the address is neither an ERC20 nor ETH', async () => {
      await expect(dust.sendDust(dust.address, oneEth, randomAddress)).to.be.revertedWith('SafeERC20: low-level call failed');
    });

    it('should revert if transfer fails', async () => {
      await expect(dust.sendDust(fakeERC20.address, tenTokens, randomAddress)).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
    });

    context('when the function is called with the correct parameters', () => {
      let ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
      let randomUser: Wallet;

      before(async () => {
        randomUser = await wallet.generateRandom();
      });

      it('should transfer ETH successfully', async () => {
        await dust.sendDust(ETH_ADDRESS, oneEth, randomUser.address);
        expect(await randomUser.getBalance()).to.equal(oneEth);
      });

      it('should emit an event if the transfer is successful', async () => {
        let ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        await expect(dust.sendDust(ETH_ADDRESS, oneEth, randomAddress)).to.emit(dust, 'DustSent').withArgs(ETH_ADDRESS, oneEth, randomAddress);
      });

      it('should call the transfer with the correct arguments', async () => {
        fakeERC20.transfer.returns(true);
        await dust.sendDust(fakeERC20.address, tenTokens, randomAddress);
        expect(fakeERC20.transfer).to.have.been.calledWith(randomAddress, tenTokens);
      });
    });
  });
});
