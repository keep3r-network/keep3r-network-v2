import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import ERC20Artifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import {
  ERC20ForTest,
  ERC20ForTest__factory,
  IERC20Metadata,
  IUniswapV3PoolForTest,
  UniV3PairManagerForTest,
  UniV3PairManagerForTest__factory,
} from '@types';
import { toUnit } from '@utils/bn';
import { ZERO_ADDRESS } from '@utils/constants';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { solidityKeccak256 } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

chai.use(solidity);
chai.use(smock.matchers);

describe('UniV3PairManager', () => {
  //factories
  let uniV3PairManagerFactory: MockContractFactory<UniV3PairManagerForTest__factory>;
  let fakeERC20Factory: ERC20ForTest__factory;

  //contracts
  let fakeERC20: ERC20ForTest;

  //fake and mocks
  let uniV3PairManager: MockContract<UniV3PairManagerForTest>;
  let uniswapPool: FakeContract<IUniswapV3PoolForTest>;
  let token0: FakeContract<IERC20Metadata>;
  let token1: FakeContract<IERC20Metadata>;

  //signers
  let deployer: SignerWithAddress;
  let newGovernor: SignerWithAddress;
  let randomJobProvider: SignerWithAddress;

  //misc

  let returnValues: BigNumber[];
  let tenTokens: BigNumber = toUnit(10);
  let actualTickLower: number;
  let actualTickUpper: number;
  let liquidity: number;
  let amount0Min: number;
  let amount1Min: number;
  let tokensOwed0: number;
  let tokensOwed1: number;
  let amount0Desired: number;
  let amount1Desired: number;
  const TICK_SPACING: number = 10;
  const MAX_TICK: number = 887272;

  before(async () => {
    [deployer, newGovernor, randomJobProvider] = await ethers.getSigners();

    uniV3PairManagerFactory = await smock.mock<UniV3PairManagerForTest__factory>('UniV3PairManagerForTest');

    fakeERC20Factory = (await ethers.getContractFactory('ERC20ForTest')) as ERC20ForTest__factory;
  });

  beforeEach(async () => {
    uniswapPool = await smock.fake('IUniswapV3Pool');
    token0 = await smock.fake(ERC20Artifact);
    token1 = await smock.fake(ERC20Artifact);

    uniswapPool.token0.returns(token0.address);
    uniswapPool.token1.returns(token1.address);
    uniswapPool.tickSpacing.returns(10);
    token0.symbol.returns('DAI');
    token1.symbol.returns('WETH');

    uniV3PairManager = await uniV3PairManagerFactory.deploy(uniswapPool.address, deployer.address);
    fakeERC20 = await fakeERC20Factory.deploy('FAKE', 'FAKE', deployer.address, toUnit(100));

    actualTickLower = await uniV3PairManager.tickLower();
    actualTickUpper = await uniV3PairManager.tickUpper();

    await fakeERC20['mint(address,uint256)'](uniV3PairManager.address, toUnit(100));
  });

  describe('constructor', () => {
    it('should assign factory to the msg sender', async () => {
      expect(await uniV3PairManager.factory()).to.equal(deployer.address);
    });

    it('should assign pool to the DAI-WETH pool', async () => {
      expect(await uniV3PairManager.pool()).to.equal(uniswapPool.address);
    });

    it('should assign fee to the DAI-WETH fee', async () => {
      expect(await uniV3PairManager.fee()).to.equal(await uniswapPool.fee());
    });

    it('should assign token0 to the DAI-WETH pool token0', async () => {
      expect(await uniV3PairManager.token0()).to.equal(await uniswapPool.token0());
    });

    it('should assign token0 to the DAI-WETH pool token1', async () => {
      expect(await uniV3PairManager.token1()).to.equal(await uniswapPool.token1());
    });

    it('should assign name to Keep3rLP - DAI/WETH', async () => {
      expect(await uniV3PairManager.name()).to.equal('Keep3rLP - DAI/WETH');
    });

    it('should assign symbol to kLP-DAI/WETH', async () => {
      expect(await uniV3PairManager.symbol()).to.equal('kLP-DAI/WETH');
    });

    it('should assign the right lower tick', async () => {
      const lowerTick = -(MAX_TICK - (MAX_TICK % TICK_SPACING));
      expect(actualTickLower).to.equal(lowerTick);
    });

    it('should assign the right upper tick', async () => {
      const upperTick = MAX_TICK - (MAX_TICK % TICK_SPACING);
      expect(actualTickUpper).to.equal(upperTick);
    });

    it('should assign governor to deployer', async () => {
      expect(await uniV3PairManager.governor()).to.equal(deployer.address);
    });
  });

  describe('uniswapV3MintCallback', () => {
    it('should revert if the caller is not the pool', async () => {
      const encodedStruct = ethers.utils.defaultAbiCoder.encode(
        ['address', 'address', 'uint24', 'address'],
        [await uniV3PairManager.token0(), await uniV3PairManager.token1(), await uniV3PairManager.fee(), deployer.address]
      );
      await expect(uniV3PairManager.connect(deployer).uniswapV3MintCallback(10, 10, encodedStruct)).to.be.revertedWith('OnlyPool()');
    });
  });

  describe('position', () => {
    it('should call uniswap pool positions function with the correct arguments', async () => {
      await uniV3PairManager.position();
      expect(uniswapPool.positions).to.be.calledOnceWith(
        solidityKeccak256(['address', 'int24', 'int24'], [uniV3PairManager.address, actualTickLower, actualTickUpper])
      );
    });

    it('should return the returning values of calling uniswap pool position function', async () => {
      returnValues = [1, 2, 3, 4, 5].map(BigNumber.from);
      uniswapPool.positions.returns(returnValues);
      const values = await uniV3PairManager.position();
      expect(values).to.deep.equal(returnValues);
    });
  });

  describe('collect', () => {
    it('should revert if the caller is not governor', async () => {
      await expect(uniV3PairManager.connect(randomJobProvider).collect()).to.be.revertedWith('OnlyGovernor()');
    });

    it('should call collect with the correct arguments', async () => {
      tokensOwed0 = 4;
      tokensOwed1 = 5;

      uniswapPool.positions.returns([1, 2, 3, 4, 5].map(BigNumber.from));
      await uniV3PairManager.collect();
      expect(uniswapPool.collect).to.be.calledOnceWith(deployer.address, actualTickLower, actualTickUpper, tokensOwed0, tokensOwed1);
    });

    it('should return the correct return values of the pool collect function', async () => {
      returnValues = [1, 2].map(BigNumber.from);
      uniswapPool.collect.returns(returnValues);
      const values = await uniV3PairManager.callStatic.collect();
      expect(values).to.deep.equal(returnValues);
    });
  });

  describe('burn', () => {
    it('should revert if caller does not have credits', async () => {
      amount0Min = 5;
      amount1Min = 5;

      uniswapPool.burn.returns([10, 20]);
      uniV3PairManager.burn.returns([10, 20]);
      await expect(uniV3PairManager.connect(randomJobProvider).burn(liquidity, amount0Min, amount1Min, newGovernor.address)).to.be.reverted;
    });

    context('when the caller has credits', () => {
      beforeEach(async () => {
        liquidity = 10000;
        amount0Min = 5;
        amount1Min = 5;
        tokensOwed0 = 10;
        tokensOwed1 = 20;

        await uniV3PairManager.setVariable('balanceOf', {
          [deployer.address]: tenTokens,
        });
        await uniV3PairManager.setVariable('totalSupply', tenTokens);
        uniswapPool.burn.returns([10, 20]);
        uniV3PairManager.burn.returns([10, 20]);
      });

      it('should call the pools burn function with the correct arguments', async () => {
        await uniV3PairManager.connect(deployer).burn(liquidity, amount0Min, amount1Min, newGovernor.address);
        expect(uniswapPool.burn).to.be.calledOnceWith(actualTickLower, actualTickUpper, liquidity);
      });

      it('should call the pools collect function with the correct arguments', async () => {
        await uniV3PairManager.connect(deployer).burn(liquidity, amount0Min, amount1Min, newGovernor.address);
        expect(uniswapPool.collect).to.be.calledOnceWith(newGovernor.address, actualTickLower, actualTickUpper, tokensOwed0, tokensOwed1);
      });

      it('should revert if burn returns less than amountMin', async () => {
        liquidity = 1;
        amount0Min = 20;
        amount1Min = 30;

        expect(uniV3PairManager.burn(liquidity, amount0Min, amount1Min, deployer.address)).to.be.revertedWith('ExcessiveSlippage()');
      });
    });
  });

  describe('approve', () => {
    it('should increase the balance of the spender', async () => {
      await uniV3PairManager.connect(deployer).approve(newGovernor.address, tenTokens);
      expect(await uniV3PairManager.allowance(deployer.address, newGovernor.address)).to.equal(tenTokens);
    });

    it('should emit an event if approve is successful', async () => {
      await expect(await uniV3PairManager.connect(deployer).approve(newGovernor.address, tenTokens))
        .to.emit(uniV3PairManager, 'Approval')
        .withArgs(deployer.address, newGovernor.address, tenTokens);
    });
  });

  describe('transfer', () => {
    context('when user does not have credits and tries to transfer', () => {
      it('should revert', async () => {
        await expect(uniV3PairManager.connect(deployer).transfer(newGovernor.address, tenTokens)).to.be.reverted;
      });
    });

    context('when user has credits', () => {
      beforeEach(async () => {
        await uniV3PairManager.setVariable('balanceOf', {
          [deployer.address]: tenTokens,
        });
      });

      it('should transfer tokens from one account to another', async () => {
        await uniV3PairManager.connect(deployer).transfer(newGovernor.address, tenTokens);
        expect(await uniV3PairManager.balanceOf(newGovernor.address)).to.deep.equal(tenTokens);
      });

      it('should emit an event when a transfer is successful', async () => {
        await expect(uniV3PairManager.connect(deployer).transfer(newGovernor.address, tenTokens))
          .to.emit(uniV3PairManager, 'Transfer')
          .withArgs(deployer.address, newGovernor.address, tenTokens);
      });
    });
  });

  describe('transferFrom', () => {
    it('it should revert when the user does not have funds and has approved an spender', async () => {
      expect(await uniV3PairManager.connect(deployer).approve(newGovernor.address, tenTokens));
      await expect(uniV3PairManager.connect(newGovernor).transferFrom(deployer.address, newGovernor.address, tenTokens)).to.be.reverted;
    });

    context('when user has funds and has approved an spender', () => {
      beforeEach(async () => {
        await uniV3PairManager.setVariable('balanceOf', {
          [deployer.address]: tenTokens,
        });
        await uniV3PairManager.connect(deployer).approve(newGovernor.address, tenTokens);
      });

      it('should transfer tokens from one account to another', async () => {
        await uniV3PairManager.connect(newGovernor).transferFrom(deployer.address, newGovernor.address, tenTokens);
        expect(await uniV3PairManager.balanceOf(newGovernor.address)).to.deep.equal(tenTokens);
      });

      it('should emit an event when a transfer is successful', async () => {
        await expect(await uniV3PairManager.connect(newGovernor).transferFrom(deployer.address, newGovernor.address, tenTokens))
          .to.emit(uniV3PairManager, 'Transfer')
          .withArgs(deployer.address, newGovernor.address, tenTokens);
      });

      it('should reduce the spenders allowance after a transferFrom', async () => {
        await uniV3PairManager.connect(newGovernor).transferFrom(deployer.address, newGovernor.address, tenTokens);
        expect(await uniV3PairManager.allowance(deployer.address, newGovernor.address)).to.deep.equal(0);
      });

      it('should emit an event when the allowance is changed', async () => {
        await expect(await uniV3PairManager.connect(newGovernor).transferFrom(deployer.address, newGovernor.address, tenTokens))
          .to.emit(uniV3PairManager, 'Approval')
          .withArgs(deployer.address, newGovernor.address, 0);
      });
    });
  });

  describe('_addLiquidity', () => {
    ///@notice for the purpose of testing internal functions, they've been made external in the for-test contract
    ///        and given the name: internal + [original internal function name] for clarity.
    //         Example: internalAddLiquidity
    amount0Desired = 10;
    amount1Desired = 20;
    amount0Min = 30;
    amount1Min = 40;

    it('should revert if the pools mint function return values are not set', async () => {
      await expect(
        uniV3PairManager.connect(deployer).internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min)
      ).to.be.revertedWith('ExcessiveSlippage()');
    });

    context('when the pools mint function return values are set', () => {
      beforeEach(async () => {
        returnValues = [100, 200].map(BigNumber.from);
        uniswapPool.mint.returns(returnValues);
      });

      it('should return the right return values of the pools mint function', async () => {
        const encodedStruct = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint24', 'address'],
          [await uniV3PairManager.token0(), await uniV3PairManager.token1(), await uniV3PairManager.fee(), deployer.address]
        );
        await uniV3PairManager.connect(deployer).internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
        expect(uniswapPool.mint).to.have.been.calledOnceWith(
          uniV3PairManager.address,
          actualTickLower,
          actualTickUpper,
          BigNumber.from(0),
          encodedStruct
        );
      });

      it('should call pool slot0', async () => {
        await uniV3PairManager.internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
        expect(uniswapPool.slot0).to.have.been.calledOnce;
      });

      it('should revert if amountOut is lower than amountMin', async () => {
        amount0Min = 300;
        amount1Min = 400;
        await expect(uniV3PairManager.internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min)).to.be.revertedWith(
          'ExcessiveSlippage()'
        );
      });
    });
  });

  describe('_mint', () => {
    it('should mint credits to the recipient', async () => {
      await uniV3PairManager.internalMint(newGovernor.address, tenTokens);
      expect(await uniV3PairManager.balanceOf(newGovernor.address)).to.equal(tenTokens);
    });

    it('should increase the contracts totalSupply', async () => {
      await uniV3PairManager.internalMint(newGovernor.address, tenTokens);
      expect(await uniV3PairManager.totalSupply()).to.equal(tenTokens);
    });

    it('should emit an event if the credits have been minted successfuly', async () => {
      await expect(await uniV3PairManager.internalMint(newGovernor.address, tenTokens))
        .to.emit(uniV3PairManager, 'Transfer')
        .withArgs(ZERO_ADDRESS, newGovernor.address, tenTokens);
    });
  });

  describe('_burn', () => {
    it('should revert if the user does not have credits in his balance and tries to burn', async () => {
      const smallTokenAmount = 1;
      await expect(uniV3PairManager.internalBurn(deployer.address, smallTokenAmount)).to.be.reverted;
    });
    context('when user has credits in his balance', () => {
      beforeEach(async () => {
        await uniV3PairManager.setVariable('totalSupply', tenTokens);
        await uniV3PairManager.setVariable('balanceOf', {
          [deployer.address]: tenTokens,
        });
      });

      it('should burn credits to the recipient', async () => {
        await uniV3PairManager.internalBurn(deployer.address, tenTokens);
        expect(await uniV3PairManager.balanceOf(deployer.address)).to.equal(0);
      });

      it('should reduce the total supply after burning credits', async () => {
        await uniV3PairManager.internalBurn(deployer.address, tenTokens);
        expect(await uniV3PairManager.totalSupply()).to.equal(0);
      });

      it('should emit an event if the credits have been burned successfuly', async () => {
        await expect(await uniV3PairManager.internalBurn(deployer.address, tenTokens))
          .to.emit(uniV3PairManager, 'Transfer')
          .withArgs(deployer.address, ZERO_ADDRESS, tenTokens);
      });
    });
  });

  describe('_pay', () => {
    it('should transfer tokens to the recipient', async () => {
      await fakeERC20.connect(deployer).approve(uniV3PairManager.address, tenTokens);
      await uniV3PairManager.internalPay(fakeERC20.address, deployer.address, newGovernor.address, tenTokens);
      expect(await fakeERC20.balanceOf(newGovernor.address)).to.equal(tenTokens);
    });

    it('should fail if payer did not approve the contract to spend his tokens', async () => {
      await expect(uniV3PairManager.internalPay(fakeERC20.address, deployer.address, newGovernor.address, tenTokens)).to.be.revertedWith(
        'UnsuccessfulTransfer()'
      );
    });
  });
});
