import { JsonRpcSigner } from '@ethersproject/providers';
import { BasicJob, BasicJob__factory, IKasparov, IKeep3rV1, Keep3r, Keep3rHelperForTest, UniV3PairManager } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import * as common from './common';
import { HELPER_FOR_TEST_BASE_FEE } from './common';

interface GasReading {
  gasUsed: BigNumber;
  gasAccounted: BigNumber;
  gasUnaccounted: BigNumber;
}

const DAY = moment.duration(1, 'day').as('seconds');
const GAS_DELTA = 2_000;

describe('@skip-on-coverage Basic Keeper Job Interaction', () => {
  let jobOwner: JsonRpcSigner;
  let keep3r: Keep3r;
  let keep3rV1: IKeep3rV1;
  let helper: Keep3rHelperForTest;
  let job: BasicJob;
  let governance: JsonRpcSigner;
  let keeper: JsonRpcSigner;
  let snapshotId: string;
  let pair: UniV3PairManager;

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: 14271214, // block when Kasparov job is workable
    });

    jobOwner = await wallet.impersonate(common.RICH_KP3R_ADDRESS);
    keeper = await wallet.impersonate(common.RICH_ETH_ADDRESS);

    ({ keep3r, governance, keep3rV1, helper } = await common.setupKeep3r());

    // create job
    const jobFactory = (await ethers.getContractFactory('BasicJob')) as BasicJob__factory;
    job = await jobFactory.connect(jobOwner).deploy(keep3r.address);
    await keep3r.connect(governance).addJob(job.address);

    // create keeper
    await keep3r.connect(keeper).bond(keep3rV1.address, 0);
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(keep3rV1.address);

    pair = await common.createLiquidityPair(governance);
    await keep3r.connect(governance).approveLiquidity(pair.address);

    const { liquidity } = await common.addLiquidityToPair(jobOwner, pair, toUnit(1000), jobOwner);

    await pair.connect(jobOwner).approve(keep3r.address, liquidity);

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('gas recordings', () => {
    let extraGas: BigNumber;
    let keeper2: JsonRpcSigner;

    before(async () => {
      extraGas = await helper.workExtraGas();
    });

    beforeEach(async () => {
      await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, toUnit(100));
      await evm.advanceTimeAndBlock(DAY * 100);
    });

    // lots of variables are getting initialized in storage, that gas is actually unaccounted, thus not rewarded
    it('should underpay first ever work transaction', async () => {
      const tx = await job.connect(keeper).work();
      const { gasUnaccounted } = await getGasReading(tx);

      expect(gasUnaccounted).to.be.closeTo(BigNumber.from(43500), GAS_DELTA);
    });

    // some variables for the keeper are getting initialized in storage, that gas is actually unaccounted, thus not rewarded
    it('should underpay first keeper work transaction', async () => {
      keeper2 = await wallet.impersonate(common.RICH_ETH_2_ADDRESS);

      await keep3r.connect(keeper2).bond(keep3rV1.address, 0);
      await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
      await keep3r.connect(keeper2).activate(keep3rV1.address);

      await job.connect(keeper).work();

      await evm.advanceTimeAndBlock(DAY * 10);

      const tx = await job.connect(keeper2).work();
      const { gasUnaccounted } = await getGasReading(tx);

      expect(gasUnaccounted).to.be.closeTo(BigNumber.from(26500), GAS_DELTA);
    });

    it('should account all the gas used after the first work tx', async () => {
      await job.connect(keeper).work();

      const tx = await job.connect(keeper).workHard(1000);
      const { gasUnaccounted } = await getGasReading(tx);

      expect(gasUnaccounted).to.be.closeTo(BigNumber.from(0), GAS_DELTA);
    });

    it('should account the same amount of gas for more difficult works', async () => {
      await job.connect(keeper).work(); // avoid first work tx outlier

      const tx1 = await job.connect(keeper).workHard(10);
      const { gasUnaccounted: gasUnaccounted1 } = await getGasReading(tx1);

      const tx2 = await job.connect(keeper).workHard(20);
      const { gasUnaccounted: gasUnaccounted2 } = await getGasReading(tx2);

      const difference = gasUnaccounted1.sub(gasUnaccounted2);
      expect(difference).to.be.closeTo(BigNumber.from(0), 1);
    });

    it('should account all the gas used after the different work txs', async () => {
      await job.connect(keeper).work();

      const tx = await job.connect(keeper).workHard(10);
      const { gasUnaccounted } = await getGasReading(tx);

      expect(gasUnaccounted).to.be.closeTo(BigNumber.from(0), GAS_DELTA);
    });

    // some deletions happen, giving unaccounted refunds to the keeper, rewarding more than needed
    it('should overpay a bit for work after period change', async () => {
      await job.connect(keeper).work();

      await evm.advanceTimeAndBlock(DAY * 10);

      const tx = await job.connect(keeper).work();
      const { gasUnaccounted } = await getGasReading(tx);

      expect(gasUnaccounted).to.be.closeTo(BigNumber.from(-7500), GAS_DELTA);
    });

    // deletions are unaccounted refunds of gas, that's why the network is overpaying
    it('should overpay for works with lots of refunds', async () => {
      await job.connect(keeper).work(); // avoid first work tx outlier

      const tx = await job.connect(keeper).workRefund(100);
      const { gasUnaccounted } = await getGasReading(tx);

      expect(gasUnaccounted).to.be.lt(-450_000);
    });

    // this job has several deletions, generating a lot of unaccounted refunds
    it('should overpay for Kasparov job work', async () => {
      const chessJob = (await ethers.getContractAt('IKasparov', common.KASPAROV_JOB)) as IKasparov;
      const chessGovernance = await wallet.impersonate(await chessJob.governor());

      await keep3r.connect(jobOwner).addJob(chessJob.address);
      await keep3r.connect(jobOwner).addLiquidityToJob(chessJob.address, pair.address, toUnit(100));
      await evm.advanceTimeAndBlock(DAY * 10);

      await chessJob.connect(chessGovernance).setKeep3r(keep3r.address);

      await job.connect(keeper).work();

      const tx = await chessJob.connect(keeper).work();
      const { gasUnaccounted } = await getGasReading(tx);
      expect(gasUnaccounted).to.be.closeTo(BigNumber.from(-12_000), GAS_DELTA);
    });

    async function getGasReading(workTx: ContractTransaction): Promise<GasReading> {
      const validationEvent = (await keep3r.queryFilter(keep3r.filters.KeeperValidation(), workTx.blockNumber, workTx.blockNumber))[0];
      const workEvent = (await keep3r.queryFilter(keep3r.filters.KeeperWork(), workTx.blockNumber, workTx.blockNumber))[0];

      const initialGas = BigNumber.from(validationEvent.args._gasLeft);
      const finalGas = BigNumber.from(workEvent.args._gasLeft);

      const gasUsed = (await workTx.wait()).gasUsed;
      const gasAccounted = initialGas.sub(finalGas).add(extraGas);
      const gasUnaccounted = gasUsed.sub(gasAccounted);

      return { gasUsed, gasAccounted, gasUnaccounted };
    }
  });

  describe('reward', () => {
    let initialBondedKP3R: BigNumber;

    beforeEach(async () => {
      initialBondedKP3R = await keep3r.callStatic.bonds(keeper._address, keep3rV1.address);
      await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, toUnit(100));
      await evm.advanceTimeAndBlock(DAY);
    });

    it('should work the job and pay the keeper in bonded KP3R', async () => {
      await job.connect(keeper).work();
      const afterWorkBondedKP3R = await keep3r.callStatic.bonds(keeper._address, keep3rV1.address);
      expect(afterWorkBondedKP3R).to.be.gt(initialBondedKP3R);
    });

    it('should pay the keeper gas costs with helper boost and extra', async () => {
      await job.connect(keeper).work(); // avoid first work tx outlier
      initialBondedKP3R = await keep3r.callStatic.bonds(keeper._address, keep3rV1.address);

      // get parameters
      const base = await helper.callStatic.BOOST_BASE();
      const helperBoost = await helper.minBoost();

      // work
      const workTx = await job.connect(keeper).workHard(10_000);

      // calculate reward from work
      const afterWorkBondedKP3R = await keep3r.callStatic.bonds(keeper._address, keep3rV1.address);
      const reward = afterWorkBondedKP3R.sub(initialBondedKP3R);

      // calculate expected reward
      const minPriorityFee = await helper.minPriorityFee();
      const gasPrice = minPriorityFee.add(HELPER_FOR_TEST_BASE_FEE);

      const txCost = (await workTx.wait()).gasUsed.mul(gasPrice);
      const expectedReward = await helper.quote(txCost.mul(helperBoost).div(base));

      expect(reward).to.be.closeTo(expectedReward, toUnit(0.001).toNumber());
    });
  });
});
