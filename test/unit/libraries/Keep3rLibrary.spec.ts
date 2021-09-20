import IUniswapV3PoolArtifact from '@artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { BigNumber } from '@ethersproject/bignumber';
import { IUniswapV3Pool, Keep3rLibrary, Keep3rLibrary__factory } from '@types';
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';

chai.use(smock.matchers);

describe('Keep3rLibrary', () => {
  let libraryImpl: Keep3rLibrary;
  let uniV3Pool: FakeContract<IUniswapV3Pool>;

  before(async () => {
    const library = await ((await ethers.getContractFactory('Keep3rLibrary')) as Keep3rLibrary__factory).deploy();
    uniV3Pool = await smock.fake(IUniswapV3PoolArtifact.abi);
    const libraryImplFactory = await ethers.getContractFactory('Keep3rLibraryForTest', {
      libraries: {
        Keep3rLibrary: library.address,
      },
    });
    libraryImpl = (await libraryImplFactory.deploy()) as Keep3rLibrary;
  });

  beforeEach(() => {
    uniV3Pool.observe.reset();
  });

  describe('observe', () => {
    const secondsAgo = [10];
    const tick1 = BigNumber.from(1);

    beforeEach(() => {
      uniV3Pool.observe.returns([[tick1], []]);
    });

    it('should return defaults when observe fails', async () => {
      uniV3Pool.observe.reverts();
      const result = await libraryImpl.callStatic.observe(uniV3Pool.address, secondsAgo);
      expect(result).to.deep.equal([BigNumber.from(0), BigNumber.from(0), false]);
    });

    it('should call pool observe with given seconds ago', async () => {
      await libraryImpl.callStatic.observe(uniV3Pool.address, secondsAgo);
      expect(uniV3Pool.observe).to.be.calledOnceWith(secondsAgo);
    });

    it('should return response first item', async () => {
      const result = await libraryImpl.callStatic.observe(uniV3Pool.address, secondsAgo);
      expect(result).to.deep.equal([tick1, BigNumber.from(0), true]);
    });

    it('should return response first and second item if given', async () => {
      const tick2 = BigNumber.from(2);
      uniV3Pool.observe.returns([[tick1, tick2, 123], []]);
      const result = await libraryImpl.callStatic.observe(uniV3Pool.address, secondsAgo);
      expect(result).to.deep.equal([tick1, tick2, true]);
    });
  });
});
