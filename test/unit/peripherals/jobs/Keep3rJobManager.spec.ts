import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IKeep3rHelper, IKeep3rV1, IKeep3rV1Proxy, IUniswapV3Pool, Keep3rJobManagerForTest, Keep3rJobManagerForTest__factory } from '@types';
import { evm, wallet } from '@utils';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rJobManager', () => {
  const randomJob = wallet.generateRandomAddress();
  let randomUser: SignerWithAddress;
  let helper: FakeContract<IKeep3rHelper>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let jobManager: MockContract<Keep3rJobManagerForTest>;
  let jobManagerFactory: MockContractFactory<Keep3rJobManagerForTest__factory>;
  let oraclePool: FakeContract<IUniswapV3Pool>;

  let snapshotId: string;

  before(async () => {
    [, randomUser] = await ethers.getSigners();
    jobManagerFactory = await smock.mock<Keep3rJobManagerForTest__factory>('Keep3rJobManagerForTest');
    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');
    oraclePool = await smock.fake('IUniswapV3Pool');
    oraclePool.token0.returns(keep3rV1.address);

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);
    jobManager = await jobManagerFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address);
  });

  describe('addJob', () => {
    it('should not allow adding the same job twice', async () => {
      await jobManager.connect(randomUser).addJob(randomJob);

      await expect(jobManager.connect(randomUser).addJob(randomJob)).to.be.revertedWith('JobAlreadyAdded()');
    });

    it('should revert if caller has bonded funds', async () => {
      await jobManager.setVariable('hasBonded', {
        [randomJob]: true,
      });
      await expect(jobManager.connect(randomUser).addJob(randomJob)).to.be.revertedWith('AlreadyAKeeper()');
    });

    it('should set sender as job owner', async () => {
      await jobManager.connect(randomUser).addJob(randomJob);

      expect(await jobManager.jobOwner(randomJob)).to.equal(randomUser.address);
    });

    it('should emit event', async () => {
      await expect(jobManager.connect(randomUser).addJob(randomJob)).to.emit(jobManager, 'JobAddition').withArgs(randomJob, randomUser.address);
    });
  });
});
