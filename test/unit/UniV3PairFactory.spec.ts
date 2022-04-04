import { FakeContract, MockContract, MockContractFactory, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import ERC20Artifact from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { IERC20Metadata, IUniV3PairManager, UniV3PairManager, UniV3PairManagerFactory, UniV3PairManagerFactory__factory } from '@types';
import { wallet } from '@utils';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('UniV3PairManagerFactory', () => {
  //factories
  let uniV3PairManagerFactory: MockContractFactory<UniV3PairManagerFactory__factory>;

  let pair: FakeContract<IUniV3PairManager>;
  let token0: FakeContract<IERC20Metadata>;
  let token1: FakeContract<IERC20Metadata>;

  //contracts
  let uniPairFactory: MockContract<UniV3PairManagerFactory>;

  //signers
  let governance: SignerWithAddress;

  before(async () => {
    [, governance] = await ethers.getSigners();

    uniV3PairManagerFactory = await smock.mock<UniV3PairManagerFactory__factory>('UniV3PairManagerFactory');
    pair = await smock.fake<IUniV3PairManager>('UniV3PairManager');
    token0 = await smock.fake(ERC20Artifact);
    token1 = await smock.fake(ERC20Artifact);

    pair.token0.returns(token0.address);
    pair.token1.returns(token1.address);
    token0.symbol.returns('DAI');
    token1.symbol.returns('WETH');

    pair.tickSpacing.returns(10);
  });

  beforeEach(async () => {
    uniPairFactory = await uniV3PairManagerFactory.deploy(governance.address);
  });

  describe('constructor', () => {
    it('should set the governance to the deployer', async () => {
      expect(await uniPairFactory.governance()).to.equal(governance.address);
    });
  });

  describe('createPairManager', () => {
    it('should revert if the pair manager has already been initialized', async () => {
      const poolAddress = wallet.generateRandomAddress();

      await uniPairFactory.setVariable('pairManagers', {
        [poolAddress]: wallet.generateRandomAddress(),
      });

      await expect(uniPairFactory.createPairManager(poolAddress)).to.be.revertedWith('AlreadyInitialized()');
    });

    context('when deployed', () => {
      let deployedAddress: string;

      beforeEach(async () => {
        deployedAddress = await uniPairFactory.callStatic.createPairManager(pair.address);

        await uniPairFactory.createPairManager(pair.address);
      });
      it('should deploy a new manager', async () => {
        const createdManager = (await ethers.getContractAt('IUniV3PairManager', deployedAddress)) as UniV3PairManager;
        expect(await createdManager.callStatic.name()).to.equal('Keep3rLP - DAI/WETH');
      });

      it('should add the deployed manager to the mapping', async () => {
        expect(await uniPairFactory.pairManagers(pair.address)).to.equal(deployedAddress);
      });
    });

    it('should emit an event when a manager is created', async () => {
      const deployedAddress = await uniPairFactory.callStatic.createPairManager(pair.address);

      await expect(uniPairFactory.createPairManager(pair.address))
        .to.emit(uniPairFactory, 'PairCreated')
        .withArgs(pair.address, deployedAddress);
    });
  });
});
