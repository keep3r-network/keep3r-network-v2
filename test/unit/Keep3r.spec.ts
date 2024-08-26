import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IKeep3rV1, IKeep3rV1Proxy, IUniswapV3Pool, Keep3rForTest, Keep3rForTest__factory, Keep3rHelper } from '@types';
import { evm } from '@utils';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3r', () => {
  let governor: SignerWithAddress;
  let keep3r: MockContract<Keep3rForTest>;
  let helper: FakeContract<Keep3rHelper>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let kp3rWethPool: FakeContract<IUniswapV3Pool>;
  let keep3rFactory: MockContractFactory<Keep3rForTest__factory>;

  let snapshotId: string;

  before(async () => {
    [governor] = await ethers.getSigners();
    keep3rFactory = await smock.mock('Keep3rForTest');

    helper = await smock.fake('IKeep3rHelper');
    keep3rV1 = await smock.fake('IKeep3rV1');
    keep3rV1Proxy = await smock.fake('IKeep3rV1Proxy');
    kp3rWethPool = await smock.fake('IUniswapV3Pool');

    snapshotId = await evm.snapshot.take();
  });

  beforeEach(async () => {
    await evm.snapshot.revert(snapshotId);

    helper.isKP3RToken0.whenCalledWith(kp3rWethPool.address).returns(true);
    keep3r = await keep3rFactory.deploy(governor.address, helper.address, keep3rV1.address, keep3rV1Proxy.address);
  });

  it('should be connected to Keep3r Helper', async () => {
    expect(await keep3r.keep3rHelper()).to.be.equal(helper.address);
  });

  it('should be connected to Keep3r V1', async () => {
    expect(await keep3r.keep3rV1()).to.be.equal(keep3rV1.address);
  });

  it('should be connected to Keep3r V1 Proxy', async () => {
    expect(await keep3r.keep3rV1Proxy()).to.be.equal(keep3rV1Proxy.address);
  });

  it('should set deployer as governor', async () => {
    expect(await keep3r.governor()).to.be.equal(governor.address);
  });
});
