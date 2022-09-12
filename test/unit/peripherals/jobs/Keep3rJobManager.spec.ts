import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import IUniswapV3PoolArtifact from '@solidity/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import IKeep3rV1Artifact from '@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rV1ProxyArtifact from '@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import IKeep3rHelperArtifact from '@solidity/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json';
import { IUniswapV3Pool, Keep3rJobManagerForTest, Keep3rJobManagerForTest__factory } from '@types';
import { wallet } from '@utils';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rJobManager', () => {
  const randomJob = wallet.generateRandomAddress();
  let randomUser: SignerWithAddress;
  let jobManager: MockContract<Keep3rJobManagerForTest>;
  let jobManagerFactory: MockContractFactory<Keep3rJobManagerForTest__factory>;
  let oraclePool: FakeContract<IUniswapV3Pool>;

  before(async () => {
    [, randomUser] = await ethers.getSigners();
    jobManagerFactory = await smock.mock<Keep3rJobManagerForTest__factory>('Keep3rJobManagerForTest');
  });

  beforeEach(async () => {
    const helper = await smock.fake(IKeep3rHelperArtifact);
    const keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    const keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    oraclePool = await smock.fake(IUniswapV3PoolArtifact);
    oraclePool.token0.returns(keep3rV1.address);

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
