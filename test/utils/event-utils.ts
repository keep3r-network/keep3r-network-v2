import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider';

export async function readArgFromEvent<T>(response: TransactionResponse, eventName: string, paramName: string): Promise<T | undefined> {
  const receipt = await response.wait();
  for (const event of getEvents(receipt)) {
    if (event.event === eventName) {
      return event.args[paramName];
    }
  }
}

export async function readArgsFromEvent(response: TransactionResponse, eventName: string): Promise<any[][]> {
  const receipt = await response.wait();
  return getEvents(receipt)
    .filter(({ event }) => event === eventName)
    .map((event) => event.args);
}

export async function readArgFromEventOrFail<T>(response: TransactionResponse, eventName: string, paramName: string): Promise<T> {
  const result = await readArgFromEvent<T>(response, eventName, paramName);
  if (result) {
    return result;
  }
  throw new Error(`Failed to find event with name ${eventName}`);
}

function getEvents(receipt: TransactionReceipt): Event[] {
  // @ts-ignore
  return receipt.events;
}

type Event = {
  event: string; // Event name
  args: any;
};
