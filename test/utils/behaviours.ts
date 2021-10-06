import { smock } from '@defi-wonderland/smock';
import { Provider } from '@ethersproject/providers';
import chai, { expect } from 'chai';
import { Signer } from 'ethers';
import { contracts, wallet } from '.';
import { toUnit } from './bn';

chai.use(smock.matchers);

export type Impersonator = Signer | Provider | string;

export const onlyGovernance = createOnlyCallableCheck(['governance'], 'OnlyGovernance()');
export const onlyPendingGovernance = createOnlyCallableCheck(['pending governance'], 'OnlyPendingGovernance()');
export const onlyJobOwner = createOnlyCallableCheck(['job owner'], 'OnlyJobOwner()');
export const onlyDisputer = createOnlyCallableCheck(['disputer'], 'OnlyDisputer()');
export const onlySlasher = createOnlyCallableCheck(['slasher'], 'OnlySlasher()');
export const onlyKeep3r = createOnlyCallableCheck(['keep3r'], 'OnlyKeep3r()');

export function createOnlyCallableCheck(allowedLabels: string[], error: string) {
  return (
    delayedContract: () => any,
    fnName: string,
    allowedWallet: Impersonator | Impersonator[] | (() => Impersonator | Impersonator[]),
    args: unknown[] | (() => unknown[])
  ) => {
    allowedLabels.forEach((allowedLabel, index) => {
      it(`should be callable by ${allowedLabel}`, async () => {
        let impersonator = allowedWallet;
        if (typeof allowedWallet === 'function') impersonator = allowedWallet();
        if (Array.isArray(impersonator)) impersonator = impersonator[index];

        return expect(callFunction(impersonator as Impersonator)).not.to.be.revertedWith(error);
      });
    });

    it('should not be callable by any address', async () => {
      const any = await wallet.generateRandom();
      await contracts.setBalance(any.address, toUnit(1000000));
      return expect(callFunction(any)).to.be.revertedWith(error);
    });

    function callFunction(impersonator: Impersonator) {
      const argsArray: unknown[] = typeof args === 'function' ? args() : args;
      const fn = delayedContract().connect(impersonator)[fnName] as (...args: unknown[]) => unknown;
      return fn(...argsArray);
    }
  };
}
