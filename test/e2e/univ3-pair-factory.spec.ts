import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { UniV3PairManager, UniV3PairManagerFactory, UniV3PairManagerFactory__factory } from '@types';
import { evm } from '@utils';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as common from './common';

describe('UniV3PairManagerFactory', () => {
  //factories
  let uniV3PairManagerFactory: UniV3PairManagerFactory__factory;

  //contracts
  let uniPairFactory: UniV3PairManagerFactory;
  let createdManager: UniV3PairManager;

  //signers
  let governance: SignerWithAddress;

  //misc
  let snapshotId: string;

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    [, governance] = await ethers.getSigners();

    uniV3PairManagerFactory = (await ethers.getContractFactory('UniV3PairManagerFactory')) as UniV3PairManagerFactory__factory;

    uniPairFactory = await uniV3PairManagerFactory.connect(governance).deploy();

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('createPairManager', () => {
    let createdManagerAddress: string;

    beforeEach(async () => {
      await uniPairFactory.createPairManager(common.KP3R_WETH_V3_POOL_ADDRESS);
      createdManagerAddress = await uniPairFactory.callStatic.pairManagers(common.KP3R_WETH_V3_POOL_ADDRESS);
      createdManager = (await ethers.getContractAt('IUniV3PairManager', createdManagerAddress)) as UniV3PairManager;
    });

    it('should match the expected address of deployment', async () => {
      const expectedAddress = ethers.utils.getContractAddress({
        from: uniPairFactory.address,
        nonce: (await ethers.provider.getTransactionCount(uniPairFactory.address)) - 1,
      });
      expect(createdManagerAddress).to.eq(expectedAddress);
    });

    it('should set the governance of the created pair manager to the owner of the factory', async () => {
      expect(await createdManager.governance()).to.equal(governance.address);
    });
  });
});
