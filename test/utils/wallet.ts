import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Wallet } from 'ethers';
import { getAddress } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { randomHex } from 'web3-utils';

export const impersonate = async (address: string): Promise<JsonRpcSigner> => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return ethers.provider.getSigner(address);
};

export const generateRandom = async () => {
  return (await Wallet.createRandom()).connect(ethers.provider);
};

export const generateRandomWithEth = async (amount: BigNumber) => {
  const [governance] = await ethers.getSigners();
  const wallet = await generateRandom();
  await governance.sendTransaction({ to: wallet.address, value: amount });
  return wallet;
};

export const generateRandomAddress = () => {
  return getAddress(randomHex(20));
};
