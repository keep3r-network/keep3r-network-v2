import { ERC20ForTest, ERC20ForTest__factory } from '@types';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

export const deploy = async ({
  name,
  symbol,
  initialAccount,
  initialAmount,
}: {
  name?: string;
  symbol?: string;
  initialAccount: string;
  initialAmount: BigNumber;
}): Promise<ERC20ForTest> => {
  const erc20MockContract = (await ethers.getContractFactory('contracts/for-test/ERC20ForTest.sol:ERC20ForTest')) as ERC20ForTest__factory;
  return await erc20MockContract.deploy(name || 'TestToken', symbol || 'TSTT', initialAccount, initialAmount);
};
