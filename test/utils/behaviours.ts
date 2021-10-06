import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Provider } from '@ethersproject/providers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract, ContractFactory, ContractInterface, Signer } from 'ethers';
import { getStatic } from 'ethers/lib/utils';
import { contracts, wallet } from '.';
import { toUnit } from './bn';

chai.use(chaiAsPromised);

export type Impersonator = Signer | Provider | string;

export const checkTxRevertedWithMessage = async ({
  tx,
  message,
}: {
  tx: Promise<TransactionResponse>;
  message: RegExp | string;
}): Promise<void> => {
  await expect(tx).to.be.reverted;
  if (message instanceof RegExp) {
    await expect(tx).eventually.rejected.have.property('message').match(message);
  } else {
    await expect(tx).to.be.revertedWith(message);
  }
};

export const checkTxRevertedWithZeroAddress = async (tx: Promise<TransactionResponse>): Promise<void> => {
  await checkTxRevertedWithMessage({
    tx,
    message: /zero\saddress/,
  });
};

export const deployShouldRevertWithZeroAddress = async ({ contract, args }: { contract: ContractFactory; args: any[] }): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = contract.signer.sendTransaction(deployContractTx);
  await checkTxRevertedWithZeroAddress(tx);
};

export const deployShouldRevertWithMessage = async ({
  contract,
  args,
  message,
}: {
  contract: ContractFactory;
  args: any[];
  message: string;
}): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = contract.signer.sendTransaction(deployContractTx);
  await checkTxRevertedWithMessage({ tx, message });
};

export const txShouldRevertWithZeroAddress = async ({
  contract,
  func,
  args,
}: {
  contract: Contract;
  func: string;
  args: any[];
  tx?: Promise<TransactionResponse>;
}): Promise<void> => {
  const tx = contract[func](...args);
  await checkTxRevertedWithZeroAddress(tx);
};

export const txShouldRevertWithMessage = async ({
  contract,
  func,
  args,
  message,
}: {
  contract: Contract;
  func: string;
  args: any[];
  message: string;
}): Promise<void> => {
  const tx = contract[func](...args);
  await checkTxRevertedWithMessage({ tx, message });
};

export const checkTxEmittedEvents = async ({
  contract,
  tx,
  events,
}: {
  contract: Contract;
  tx: TransactionResponse;
  events: { name: string; args: any[] }[];
}): Promise<void> => {
  for (let i = 0; i < events.length; i++) {
    await expect(tx)
      .to.emit(contract, events[i].name)
      .withArgs(...events[i].args);
  }
};

export const deployShouldSetVariablesAndEmitEvents = async ({
  contract,
  args,
  settersGettersVariablesAndEvents,
}: {
  contract: ContractFactory;
  args: any[];
  settersGettersVariablesAndEvents: {
    getterFunc: string;
    variable: any;
    eventEmitted: string;
  }[];
}): Promise<void> => {
  const deployContractTx = await contract.getDeployTransaction(...args);
  const tx = await contract.signer.sendTransaction(deployContractTx);
  const address = getStatic<(tx: TransactionResponse) => string>(contract.constructor, 'getContractAddress')(tx);
  const deployedContract = getStatic<(address: string, contractInterface: ContractInterface, signer?: Signer) => Contract>(
    contract.constructor,
    'getContract'
  )(address, contract.interface, contract.signer);
  await txShouldHaveSetVariablesAndEmitEvents({
    contract: deployedContract,
    tx,
    settersGettersVariablesAndEvents,
  });
};

export const txShouldHaveSetVariablesAndEmitEvents = async ({
  contract,
  tx,
  settersGettersVariablesAndEvents,
}: {
  contract: Contract;
  tx: TransactionResponse;
  settersGettersVariablesAndEvents: {
    getterFunc: string;
    variable: any;
    eventEmitted: string;
  }[];
}): Promise<void> => {
  for (let i = 0; i < settersGettersVariablesAndEvents.length; i++) {
    await checkTxEmittedEvents({
      contract,
      tx,
      events: [
        {
          name: settersGettersVariablesAndEvents[i].eventEmitted,
          args: [settersGettersVariablesAndEvents[i].variable],
        },
      ],
    });
    expect(await contract[settersGettersVariablesAndEvents[i].getterFunc]()).to.eq(settersGettersVariablesAndEvents[i].variable);
  }
};

export const txShouldSetVariableAndEmitEvent = async ({
  contract,
  setterFunc,
  getterFunc,
  variable,
  eventEmitted,
}: {
  contract: Contract;
  setterFunc: string;
  getterFunc: string;
  variable: any;
  eventEmitted: string;
}): Promise<void> => {
  expect(await contract[getterFunc]()).to.not.eq(variable);
  const tx = contract[setterFunc](variable);
  await txShouldHaveSetVariablesAndEmitEvents({
    contract,
    tx,
    settersGettersVariablesAndEvents: [
      {
        getterFunc,
        variable,
        eventEmitted,
      },
    ],
  });
};

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
      await contracts.setBalance(any.address, toUnit(1000));
      return expect(callFunction(any)).to.be.revertedWith(error);
    });

    function callFunction(impersonator: Impersonator) {
      const argsArray: unknown[] = typeof args === 'function' ? args() : args;
      const fn = delayedContract().connect(impersonator)[fnName] as (...args: unknown[]) => unknown;
      return fn(...argsArray);
    }
  };
}
