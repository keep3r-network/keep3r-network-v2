import IUniswapV3PoolArtifact from '@contracts/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import IKeep3rV1Artifact from '@contracts/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rV1ProxyArtifact from '@contracts/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import IKeep3rHelperArtifact from '@contracts/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json';
import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IUniswapV3Pool, Keep3rJobManagerForTest, Keep3rJobManagerForTest__factory, Keep3rLibrary } from '@types';
import { behaviours, wallet } from '@utils';
import chai, { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rJobManager', () => {
  const randomJob = wallet.generateRandomAddress();
  const randomJob2 = wallet.generateRandomAddress();
  let governance: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let jobManager: MockContract<Keep3rJobManagerForTest>;
  let jobManagerFactory: MockContractFactory<Keep3rJobManagerForTest__factory>;
  let oraclePool: FakeContract<IUniswapV3Pool>;

  before(async () => {
    [governance, randomUser] = await ethers.getSigners();
    const library = (await (await ethers.getContractFactory('Keep3rLibrary')).deploy()) as any as Keep3rLibrary;
    jobManagerFactory = await smock.mock<Keep3rJobManagerForTest__factory>('Keep3rJobManagerForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
  });

  beforeEach(async () => {
    const helper = await smock.fake(IKeep3rHelperArtifact);
    const keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    const keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token0.returns(keep3rV1.address);

    jobManager = await jobManagerFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
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
      const blockNumber: BigNumber = BigNumber.from(await ethers.provider.getBlockNumber());

      await expect(jobManager.connect(randomUser).addJob(randomJob))
        .to.emit(jobManager, 'JobAddition')
        .withArgs(randomJob, blockNumber.add(1), randomUser.address);
    });
  });

  describe('removeJob', () => {
    beforeEach(async () => {
      await jobManager.addJob(randomJob);
    });

    behaviours.onlyGovernance(() => jobManager, 'removeJob', governance, [randomJob]);

    it('should not be able to remove unexistent job', async () => {
      await expect(jobManager.connect(governance).removeJob(randomJob2)).to.be.revertedWith('JobUnexistent()');
    });

    it('should not be able to remove the same job twice', async () => {
      await jobManager.connect(governance).removeJob(randomJob);

      await expect(jobManager.connect(governance).removeJob(randomJob)).to.be.revertedWith('JobUnexistent()');
    });

    it('should remove job', async () => {
      await jobManager.connect(governance).removeJob(randomJob);

      expect(await jobManager.connect(governance).isJobEnabled(randomJob)).to.equal(false);
    });

    it('should leave not removed jobs untouched', async () => {
      await jobManager.connect(governance).addJob(randomJob2);
      await jobManager.connect(governance).removeJob(randomJob);

      expect(await jobManager.connect(governance).isJobEnabled(randomJob2)).to.equal(true);
    });

    it('should emit event', async () => {
      const blockNumber: BigNumber = BigNumber.from(await ethers.provider.getBlockNumber());

      await expect(jobManager.connect(governance).removeJob(randomJob))
        .to.emit(jobManager, 'JobRemoval')
        .withArgs(randomJob, blockNumber.add(1), governance.address);
    });
  });
});
