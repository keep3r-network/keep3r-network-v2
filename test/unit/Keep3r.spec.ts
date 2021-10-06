import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import IUniswapV3PoolArtifact from '@solidity/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json';
import IKeep3rV1Artifact from '@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json';
import IKeep3rV1ProxyArtifact from '@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json';
import IKeep3rHelperArtifact from '@solidity/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json';
import { IKeep3rV1, IKeep3rV1Proxy, IUniswapV3Pool, Keep3rForTest, Keep3rForTest__factory, Keep3rHelper } from '@types';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3r', () => {
  let governance: SignerWithAddress;
  let keep3r: MockContract<Keep3rForTest>;
  let helper: FakeContract<Keep3rHelper>;
  let keep3rV1: FakeContract<IKeep3rV1>;
  let keep3rV1Proxy: FakeContract<IKeep3rV1Proxy>;
  let kp3rWethPool: FakeContract<IUniswapV3Pool>;
  let keep3rFactory: MockContractFactory<Keep3rForTest__factory>;

  before(async () => {
    [governance] = await ethers.getSigners();
    keep3rFactory = await smock.mock('Keep3rForTest');
  });

  beforeEach(async () => {
    helper = await smock.fake(IKeep3rHelperArtifact);
    keep3rV1 = await smock.fake(IKeep3rV1Artifact);
    keep3rV1Proxy = await smock.fake(IKeep3rV1ProxyArtifact);
    kp3rWethPool = await smock.fake(IUniswapV3PoolArtifact);
  });

  beforeEach(async () => {
    helper.isKP3RToken0.whenCalledWith(kp3rWethPool.address).returns(true);

    keep3r = await keep3rFactory.deploy(governance.address, helper.address, keep3rV1.address, keep3rV1Proxy.address, kp3rWethPool.address);
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

  it('should be connected to KP3R/WETH oracle pool', async () => {
    expect(await keep3r.kp3rWethPool()).to.be.equal(kp3rWethPool.address);
  });

  it('should store the token order from the KP3R/WETH oracle pool', async () => {
    expect(await keep3r.viewTickOrder(kp3rWethPool.address)).to.be.true;
  });

  it('should set deployer as governance', async () => {
    expect(await keep3r.governance()).to.be.equal(governance.address);
  });
});
