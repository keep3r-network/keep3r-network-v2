import { JsonRpcSigner } from '@ethersproject/providers';
import { IERC20, IKeep3rV1, IKeep3rV1Proxy, Keep3r } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import moment from 'moment';
import * as common from './common';

describe('@skip-on-coverage Keep3r', () => {
  let dai: IERC20;
  let keeper: JsonRpcSigner;
  let governor: JsonRpcSigner;
  let keep3r: Keep3r;
  let keep3rV1: IKeep3rV1;
  let keep3rV1Proxy: IKeep3rV1Proxy;
  let keep3rV1ProxyGovernance: JsonRpcSigner;
  let snapshotId: string;

  before(async () => {
    dai = (await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.DAI_ADDRESS)) as IERC20;

    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    ({ keep3r, governor, keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance } = await common.setupKeep3r());

    keeper = await wallet.impersonate(common.RICH_ETH_DAI_ADDRESS);

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  it('should fail to activate before 3 days', async () => {
    // bond and activate
    await keep3r.connect(keeper).bond(keep3rV1.address, 0);
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds') - 60);
    await expect(keep3r.connect(keeper).activate(keep3rV1.address)).to.be.revertedWith('BondsLocked()');
  });

  it('should fail to withdraw funds without waiting 3 days after unbond', async () => {
    // send some KP3R to keeper
    await keep3rV1Proxy.connect(keep3rV1ProxyGovernance)['mint(address,uint256)'](keeper._address, toUnit(1));

    // bond and activate
    await keep3rV1.connect(keeper).approve(keep3r.address, toUnit(1));
    await keep3r.connect(keeper).bond(keep3rV1.address, toUnit(1));
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(keep3rV1.address);

    // unbond and withdraw
    await keep3r.connect(keeper).unbond(keep3rV1.address, toUnit(1));
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds') - 60);
    await expect(keep3r.connect(keeper).withdraw(keep3rV1.address)).to.be.revertedWith('UnbondsLocked()');
  });

  it('should be able to bond KP3R tokens', async () => {
    // send some KP3R to keeper
    await keep3rV1Proxy.connect(keep3rV1ProxyGovernance)['mint(address,uint256)'](keeper._address, toUnit(1));

    // bond and activate
    await keep3rV1.connect(keeper).approve(keep3r.address, toUnit(1));
    await keep3r.connect(keeper).bond(keep3rV1.address, toUnit(1));
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(keep3rV1.address);

    expect(await keep3rV1.balanceOf(keeper._address)).to.equal(0);
    expect(await keep3r.bonds(keeper._address, keep3rV1.address)).to.equal(toUnit(1));
    expect(await keep3r.callStatic.isKeeper(keeper._address)).to.be.true;
  });

  it('should be able to bond any ERC20 tokens', async () => {
    // bond and activate
    await dai.connect(keeper).approve(keep3r.address, toUnit(1));
    await keep3r.connect(keeper).bond(dai.address, toUnit(1));
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(dai.address);

    expect(await dai.balanceOf(keep3r.address)).to.equal(toUnit(1));
    expect(await keep3r.bonds(keeper._address, dai.address)).to.equal(toUnit(1));
    expect(await keep3r.callStatic.isKeeper(keeper._address)).to.be.true;
  });

  describe('on Keep3rV1 address change', () => {
    const BONDS = toUnit(1);
    let newERC20: IERC20;

    beforeEach(async () => {
      // send some KP3R to keeper
      await keep3rV1Proxy.connect(keep3rV1ProxyGovernance)['mint(address,uint256)'](keeper._address, BONDS);
      // bond and activate
      await keep3rV1.connect(keeper).approve(keep3r.address, BONDS);
      await keep3r.connect(keeper).bond(keep3rV1.address, BONDS);
      await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
      await keep3r.connect(keeper).activate(keep3rV1.address);

      newERC20 = (await (await ethers.getContractFactory('ERC20ForTest')).deploy('NewKP3R', 'nKP3R', keeper._address, BONDS)) as IERC20;

      await keep3r.connect(governor).setKeep3rV1(newERC20.address);
      await keep3rV1Proxy.connect(keep3rV1ProxyGovernance).setKeep3rV1(newERC20.address);
    });

    it('should reset totalBonds accountance', async () => {
      expect(await keep3r.totalBonds()).to.eq(0);

      // bond and activate
      await newERC20.connect(keeper).approve(keep3r.address, BONDS);
      await keep3r.connect(keeper).bond(newERC20.address, BONDS);
      await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
      await keep3r.connect(keeper).activate(newERC20.address);
      expect(await keep3r.totalBonds()).to.eq(BONDS);
    });

    it('should be able to withdraw both bonds', async () => {
      // bond and activate
      await newERC20.connect(keeper).approve(keep3r.address, BONDS);
      await keep3r.connect(keeper).bond(newERC20.address, BONDS);
      await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
      await keep3r.connect(keeper).activate(newERC20.address);

      await keep3r.connect(keeper).unbond(keep3rV1.address, BONDS);
      await keep3r.connect(keeper).unbond(newERC20.address, BONDS);

      await evm.advanceTimeAndBlock(moment.duration(14, 'days').as('seconds'));
      // should be able to withdraw both bonds
      await keep3r.connect(keeper).withdraw(keep3rV1.address);
      await keep3r.connect(keeper).withdraw(newERC20.address);
    });
  });
});
