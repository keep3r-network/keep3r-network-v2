import { JsonRpcSigner } from '@ethersproject/providers';
import { Keep3r } from '@types';
import { evm, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { snapshot } from '@utils/evm';
import { expect } from 'chai';
import * as common from './common';

describe('@skip-on-coverage Miscellaneous', () => {
  let ethWhale: JsonRpcSigner;
  let keep3r: Keep3r;
  let snapshotId: string;

  beforeEach(async () => {
    await evm.reset({
      jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
      blockNumber: common.FORK_BLOCK_NUMBER,
    });

    ethWhale = await wallet.impersonate(common.RICH_ETH_ADDRESS);

    ({ keep3r } = await common.setupKeep3r());

    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    snapshot.revert(snapshotId);
  });

  it('should fail to transfer ether to the contract', async () => {
    await expect(
      ethWhale.sendTransaction({
        to: keep3r.address,
        value: toUnit(1),
      })
    ).to.be.revertedWith(`function selector was not recognized and there's no fallback nor receive function`);
  });
});
