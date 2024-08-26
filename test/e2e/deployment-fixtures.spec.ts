import { JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import * as Type from '@typechained';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { getContractFromFixture } from '@utils/contracts';
import { expect } from 'chai';
import { deployments, ethers } from 'hardhat';
import * as common from './common';

describe('@skip-on-coverage Fixture', () => {
  let signer: SignerWithAddress;
  let whale: JsonRpcSigner;
  let keep3r: Type.Keep3r;
  let pairManager: Type.UniV3PairManager;
  let kp3rV1: Type.IERC20;
  let wkLP: Type.IERC20;

  beforeEach(async () => {
    [signer] = await ethers.getSigners();

    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: 15000000,
    });

    whale = await wallet.impersonate(common.RICH_KP3R_ADDRESS);
    const kp3rV1 = (await ethers.getContractAt('IERC20', common.KP3R_V1_ADDRESS)) as Type.ERC20;
    await kp3rV1.connect(whale).transfer(signer.address, toUnit(100));
  });

  describe('Keep3r', () => {
    beforeEach(async () => {
      await deployments.fixture(['keep3r']);
      await deployments.fixture(['create-pair-manager'], { keepExistingDeployments: true });

      kp3rV1 = (await getContractFromFixture('KP3Rv1', 'IERC20')) as Type.IERC20;
      keep3r = (await getContractFromFixture('Keep3r')) as Type.Keep3r;
      pairManager = (await getContractFromFixture('UniV3PairManager')) as Type.UniV3PairManager;

      await keep3r.bond(kp3rV1.address, 0);
      await evm.advanceTimeAndBlock((await keep3r.bondTime()).toNumber());
      await keep3r.activate(kp3rV1.address);

      await keep3r.approveLiquidity(pairManager.address);

      await setKp3rMinter(keep3r);
    });

    it('should be workable with forced credits', async () => {
      const jobForTest = await common.createJobForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      await common.forceCreditsToJob(keep3r, jobForTest.address);

      await jobForTest.work();

      const bonds = await keep3r.bonds(signer.address, kp3rV1.address);
      await keep3r.unbond(kp3rV1.address, bonds);
      await evm.advanceTimeAndBlock((await keep3r.unbondTime()).toNumber());
      await keep3r.withdraw(kp3rV1.address);
    });

    it('should be workable', async () => {
      const jobForTest = await common.createJobForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      const { liquidity } = await common.mintLiquidity(whale, pairManager, toUnit(5), signer.address);
      await pairManager.approve(keep3r.address, toUnit(10));
      await keep3r.addLiquidityToJob(jobForTest.address, pairManager.address, liquidity);

      await evm.advanceTimeAndBlock(86400);
      await jobForTest.workHard(1);
    });

    it('should deploy a new helper', async () => {
      const prevKeep3rHelper = (await getContractFromFixture('Keep3rHelper')) as Type.Keep3rHelper;
      await deployments.fixture(['redeploy-keep3r-helper'], { keepExistingDeployments: true });
      const newKeep3rHelper = (await getContractFromFixture('Keep3rHelper')) as Type.Keep3rHelper;

      expect(newKeep3rHelper.address).not.to.eq(prevKeep3rHelper.address);
    });
  });

  describe('Keep3rForTestnet', () => {
    beforeEach(async () => {
      await deployments.fixture(['testnet-keep3r']);

      kp3rV1 = (await getContractFromFixture('KP3Rv1', 'ERC20')) as Type.ERC20ForTest;
      keep3r = (await getContractFromFixture('Keep3rForTestnet')) as Type.Keep3r;
      pairManager = (await getContractFromFixture('UniV3PairManager')) as Type.UniV3PairManager;

      // instant keeper activation
      await keep3r.bond(kp3rV1.address, 0);
      await keep3r.activate(kp3rV1.address);

      await setKp3rMinter(keep3r);
    });

    it('should be workable with forced credits', async () => {
      const jobForTest = await common.createJobForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      await common.forceCreditsToJob(keep3r, jobForTest.address);

      await jobForTest.work();

      // instant withdraw
      const bonds = await keep3r.bonds(signer.address, kp3rV1.address);
      await keep3r.unbond(kp3rV1.address, bonds);
      await keep3r.withdraw(kp3rV1.address);
    });

    it('should be workable', async () => {
      const jobForTest = await common.createJobForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      const { liquidity } = await common.mintLiquidity(whale, pairManager, toUnit(5), signer.address);
      await pairManager.approve(keep3r.address, toUnit(10));
      await keep3r.addLiquidityToJob(jobForTest.address, pairManager.address, liquidity);

      await evm.advanceTimeAndBlock(86400);
      await jobForTest.workHard(10);
    });
  });

  describe('Keep3rSidechain', () => {
    beforeEach(async () => {
      await deployments.fixture(['keep3r-sidechain']);

      kp3rV1 = (await getContractFromFixture('KP3Rv1', 'ERC20')) as Type.ERC20ForTest;
      keep3r = (await getContractFromFixture('Keep3rSidechain')) as Type.Keep3r;
      const keep3rEscrow = (await getContractFromFixture('Keep3rEscrow')) as Type.Keep3rEscrow;
      const keep3rHelper = (await getContractFromFixture('Keep3rHelperSidechain')) as Type.Keep3rHelperSidechain;
      const kp3rWethOracle = await getContractFromFixture('Kp3rWethOracle', 'IUniswapV3Pool');

      await keep3r.bond(kp3rV1.address, 0);
      await evm.advanceTimeAndBlock((await keep3r.bondTime()).toNumber());
      await keep3r.activate(kp3rV1.address);

      wkLP = kp3rV1; // uses KP3Rv1 as wkLP
      await keep3rHelper.setOracle(wkLP.address, kp3rWethOracle.address);
      await keep3r.approveLiquidity(wkLP.address);

      kp3rV1.connect(whale).transfer(keep3rEscrow.address, toUnit(100));

      await setKp3rMinter(keep3r);
    });

    it('should be workable with forced credits', async () => {
      const jobForTest = await common.createJobRatedForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      await common.forceCreditsToJob(keep3r, jobForTest.address);

      await jobForTest.work();

      const bonds = await keep3r.bonds(signer.address, kp3rV1.address);
      await keep3r.unbond(kp3rV1.address, bonds);
      await evm.advanceTimeAndBlock((await keep3r.unbondTime()).toNumber());
      await keep3r.withdraw(kp3rV1.address);
    });

    it('should be workable', async () => {
      const jobForTest = await common.createJobRatedForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      const liquidity = toUnit(10);
      await wkLP.approve(keep3r.address, liquidity);
      await keep3r.addLiquidityToJob(jobForTest.address, wkLP.address, liquidity);

      await evm.advanceTimeAndBlock(86400);
      await jobForTest.workHard(10);
    });

    it('should deploy a workable job', async () => {
      await deployments.fixture(['job-for-test']);
      const jobForTest = (await getContractFromFixture('JobForTest', 'JobForTest')) as Type.BasicJob;

      await evm.advanceTimeAndBlock(86400);
      await jobForTest.workHard(10);
    });
  });

  describe.only('Keep3rSidechainForTestnet', () => {
    beforeEach(async () => {
      await deployments.fixture(['testnet-keep3r-sidechain']);

      kp3rV1 = (await getContractFromFixture('KP3Rv1', 'ERC20')) as Type.ERC20ForTest;
      keep3r = (await getContractFromFixture('Keep3rSidechainForTestnet')) as Type.Keep3r;
      const keep3rEscrow = (await getContractFromFixture('Keep3rEscrow')) as Type.Keep3rEscrow;
      const keep3rHelper = (await getContractFromFixture('Keep3rHelperSidechain')) as Type.Keep3rHelperSidechain;
      const kp3rWethOracle = await getContractFromFixture('Kp3rWethOracle', 'IUniswapV3Pool');

      // instant keeper activation
      await keep3r.bond(kp3rV1.address, 0);
      await keep3r.activate(kp3rV1.address);

      wkLP = kp3rV1; // uses KP3Rv1 as wkLP (hardhat environment)
      await keep3rEscrow.setMinter(keep3r.address);
      await keep3rHelper.setOracle(wkLP.address, kp3rWethOracle.address);
      await keep3r.approveLiquidity(wkLP.address);

      kp3rV1.connect(whale).transfer(keep3rEscrow.address, toUnit(100));
    });

    it('should be workable with forced credits', async () => {
      const jobForTest = await common.createJobRatedForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      await evm.advanceTimeAndBlock(5 * 86400);
      await common.forceCreditsToJob(keep3r, jobForTest.address);

      await jobForTest.work();

      const bonds = await keep3r.bonds(signer.address, kp3rV1.address);
      await keep3r.unbond(kp3rV1.address, bonds);
      await keep3r.withdraw(kp3rV1.address);
    });

    it('should be workable', async () => {
      const jobForTest = await common.createJobRatedForTest(keep3r.address, signer);
      await keep3r.addJob(jobForTest.address);

      const liquidity = toUnit(10);
      await wkLP.approve(keep3r.address, liquidity);
      await keep3r.addLiquidityToJob(jobForTest.address, wkLP.address, liquidity);

      await evm.advanceTimeAndBlock(86400);
      await jobForTest.work();
    });

    it('should deploy a workable job', async () => {
      await kp3rV1.connect(whale).transfer(signer.address, toUnit(100));

      await evm.advanceTimeAndBlock(86400);
      await deployments.fixture(['job-rated-for-test'], { keepExistingDeployments: true });
      const jobForTest = (await getContractFromFixture('JobRatedForTest', 'JobRatedForTest')) as Type.BasicJob;

      await jobForTest.work();
    });
  });
});

const setKp3rMinter = async (keep3r: Type.Keep3r) => {
  let mintable;
  let proxyGovernor;
  try {
    mintable = (await ethers.getContractAt('IMintable', await keep3r.keep3rV1Proxy())) as Type.Mintable;
    proxyGovernor = await wallet.impersonate(await mintable.governor());
  } catch {
    mintable = (await ethers.getContractAt('IKeep3rV1Proxy', await keep3r.keep3rV1Proxy())) as Type.IKeep3rV1Proxy;
    proxyGovernor = await wallet.impersonate(await mintable.governance());
  }
  await mintable.connect(proxyGovernor).setMinter(keep3r.address);
};
