import { JsonRpcSigner } from '@ethersproject/providers';
import { IKeep3rV1, JobForTest, Keep3r, UniV3PairManager } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import moment from 'moment';
import * as common from './common';

describe('@skip-on-coverage Keeper Job Interaction', () => {
  let jobOwner: JsonRpcSigner;
  let keep3r: Keep3r;
  let keep3rV1: IKeep3rV1;
  let job: JobForTest;
  let governance: JsonRpcSigner;
  let keeper: JsonRpcSigner;
  let snapshotId: string;
  let pair: UniV3PairManager;

  before(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    jobOwner = await wallet.impersonate(common.RICH_KP3R_ADDRESS);
    keeper = await wallet.impersonate(common.RICH_ETH_ADDRESS);

    ({ keep3r, governance, keep3rV1 } = await common.setupKeep3r());

    // create job
    job = await common.createJobForTest(keep3r.address, jobOwner);
    await keep3r.connect(governance).addJob(job.address);

    // create keeper
    await keep3r.connect(keeper).bond(keep3rV1.address, 0);
    await evm.advanceTimeAndBlock(moment.duration(3, 'days').as('seconds'));
    await keep3r.connect(keeper).activate(keep3rV1.address);

    pair = await common.createLiquidityPair(governance);
    await keep3r.connect(governance).approveLiquidity(pair.address);

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  it('should not be able to work if there are no funds in job', async () => {
    await expect(job.connect(keeper).work()).to.be.revertedWith('InsufficientFunds()');
  });

  it('should pay the keeper with bonds from job credits', async () => {
    // add liquidity to pair
    const { liquidity } = await common.addLiquidityToPair(jobOwner, pair, toUnit(10), jobOwner);
    // add credit to job
    await pair.connect(jobOwner).approve(keep3r.address, liquidity);
    await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);
    // wait some time to mint credits
    await evm.advanceTimeAndBlock(moment.duration(5, 'days').as('seconds'));

    const keeperBondsBeforeWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);
    const jobLiquidityCreditsBeforeWork: BigNumber = await keep3r.jobLiquidityCredits(job.address);

    // work as keeper
    await job.connect(keeper).work();

    const jobLiquidityCreditsAfterWork: BigNumber = await keep3r.jobLiquidityCredits(job.address);
    const keeperBondsAfterWork: BigNumber = await keep3r.bonds(keeper._address, keep3rV1.address);
    const liquidityCreditsSpent: BigNumber = jobLiquidityCreditsBeforeWork.sub(jobLiquidityCreditsAfterWork);
    const bondsEarned: BigNumber = keeperBondsAfterWork.sub(keeperBondsBeforeWork);

    expect(liquidityCreditsSpent).to.be.gt(0);
    expect(bondsEarned).to.be.gt(0);
    expect(liquidityCreditsSpent).to.be.eq(bondsEarned);
  });
});
