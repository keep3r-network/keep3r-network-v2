import { JsonRpcSigner } from '@ethersproject/providers';
import {
  ERC20,
  ERC20ForTest,
  IKeep3rV1,
  IKeep3rV1Proxy,
  JobForTest,
  JobForTest__factory,
  Keep3r,
  Keep3rHelperForTest,
  Keep3rHelperForTest__factory,
  Keep3r__factory,
  UniV3PairManager,
  UniV3PairManager__factory,
} from '@types';
import { contracts, wallet } from '@utils';
import { toUnit } from '@utils/bn';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';

export const FORK_BLOCK_NUMBER = 14271200;
export const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
export const RICH_ETH_ADDRESS = '0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa';
export const RICH_ETH_2_ADDRESS = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';
export const RICH_ETH_DAI_ADDRESS = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';
export const RICH_WETH_ADDRESS = '0x56178a0d5f301baf6cf3e1cd53d9863437345bf9';
export const RICH_KP3R_ADDRESS = '0xf977814e90da44bfa03b6295a0616a897441acec';
export const RICH_KP3R_WETH_POOL_ADDRESS = '0x2269522ad48aeb971b25042471a44acc8c1b5eca';
export const KP3R_WETH_POOL_ADDRESS = '0xaf988afF99d3d0cb870812C325C588D8D8CB7De8';
export const KP3R_WETH_V3_POOL_ADDRESS = '0x11B7a6bc0259ed6Cf9DB8F499988F9eCc7167bf5';
export const UNISWAP_V2_ROUTER_02_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
export const UNISWAP_V2_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
export const KP3R_V1_ADDRESS = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
export const KP3R_V1_PROXY_ADDRESS = '0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d';
export const KP3R_V1_PROXY_GOVERNANCE_ADDRESS = '0x0d5dc686d0a2abbfdafdfb4d0533e886517d4e83';
export const KP3R_V1_GOVERNANCE_ADDRESS = '0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d';
export const KASPAROV_JOB = '0x54A8265ADC50fD66FD0F961cfCc8B62DE0f2B57f';
export const CHAINLINK_KP3R_ETH_PRICE_FEED = '0xe7015ccb7e5f788b8c1010fc22343473eaac3741';
export const HELPER_FOR_TEST_BASE_FEE = utils.parseUnits('100', 'gwei');

export async function setupKeep3r(): Promise<{
  keep3r: Keep3r;
  governance: JsonRpcSigner;
  keep3rV1: IKeep3rV1;
  keep3rV1Proxy: IKeep3rV1Proxy;
  keep3rV1ProxyGovernance: JsonRpcSigner;
  helper: Keep3rHelperForTest;
}> {
  // create governance with some eth
  const governance = await wallet.impersonate(wallet.generateRandomAddress());
  await contracts.setBalance(governance._address, toUnit(1000));

  // deploy proxy and set it as Keep3rV1 governance
  const { keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance } = await setupKeep3rV1();

  const helperFactory = (await ethers.getContractFactory('Keep3rHelperForTest')) as Keep3rHelperForTest__factory;
  const keep3rFactory = (await ethers.getContractFactory('Keep3r')) as Keep3r__factory;

  // calculate keep3rV2 deployment address
  const currentNonce = await ethers.provider.getTransactionCount(governance._address);
  const keeperV2Address = ethers.utils.getContractAddress({ from: governance._address, nonce: currentNonce + 1 });

  // deploy Keep3rHelperForTest and Keep3r contract
  const helper = await helperFactory.connect(governance).deploy(keeperV2Address, governance._address);
  const keep3r = await keep3rFactory
    .connect(governance)
    .deploy(governance._address, helper.address, keep3rV1.address, keep3rV1Proxy.address, KP3R_WETH_V3_POOL_ADDRESS);

  await helper.setBaseFee(HELPER_FOR_TEST_BASE_FEE);

  // set Keep3r as proxy minter
  await keep3rV1Proxy.connect(keep3rV1ProxyGovernance).setMinter(keep3r.address);

  // give some eth to Keep3r and to Keep3rV1
  await contracts.setBalance(keep3r.address, toUnit(1000));
  await contracts.setBalance(keep3rV1.address, toUnit(1000));

  return { governance, keep3r, keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance, helper };
}

export async function setupKeep3rV1(): Promise<{
  keep3rV1: IKeep3rV1;
  keep3rV1Proxy: IKeep3rV1Proxy;
  keep3rV1ProxyGovernance: JsonRpcSigner;
}> {
  // get Keep3rV1 and it's governance
  const keep3rV1 = (await ethers.getContractAt('IKeep3rV1', KP3R_V1_ADDRESS)) as IKeep3rV1;
  const keep3rV1Proxy = (await ethers.getContractAt('IKeep3rV1Proxy', KP3R_V1_PROXY_ADDRESS)) as IKeep3rV1Proxy;
  const keep3rV1ProxyGovernance = await wallet.impersonate(KP3R_V1_PROXY_GOVERNANCE_ADDRESS);

  contracts.setBalance(keep3rV1ProxyGovernance._address, toUnit(1000));

  await keep3rV1Proxy.connect(keep3rV1ProxyGovernance).acceptKeep3rV1Governance();

  return { keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance };
}

export async function createJobForTest(keep3rAddress: string, jobOwner: JsonRpcSigner): Promise<JobForTest> {
  const jobFactory = (await ethers.getContractFactory('JobForTest')) as JobForTest__factory;
  return await jobFactory.connect(jobOwner).deploy(keep3rAddress);
}

export async function createLiquidityPair(governance: JsonRpcSigner): Promise<UniV3PairManager> {
  return await ((await ethers.getContractFactory('UniV3PairManager')) as UniV3PairManager__factory).deploy(
    KP3R_WETH_V3_POOL_ADDRESS,
    governance._address
  );
}

export async function addLiquidityToPair(
  richGuy: JsonRpcSigner,
  pair: UniV3PairManager,
  amount: BigNumber,
  jobOwner: JsonRpcSigner
): Promise<{
  liquidity: BigNumber;
  spentKp3rs: BigNumber;
}> {
  const weth = (await ethers.getContractAt('ERC20ForTest', WETH_ADDRESS)) as ERC20ForTest;
  const keep3rV1 = (await ethers.getContractAt('ERC20', KP3R_V1_ADDRESS)) as ERC20;

  const initialBalance = await keep3rV1.balanceOf(richGuy._address);
  // fund RICH_KP3R address with WETH
  await weth.connect(richGuy).deposit(amount, { value: amount });
  // make ERC20 approvals to mint liquidity
  await weth.connect(richGuy).approve(pair.address, amount);
  await keep3rV1.connect(richGuy).approve(pair.address, amount);
  // mint liquidity in UniV3PairManager
  const liquidity = await pair.connect(richGuy).callStatic.mint(amount, amount, 0, 0, richGuy._address);
  await pair.connect(richGuy).mint(amount, amount, 0, 0, richGuy._address);

  // transfers, approves and adds liquidity to job
  await pair.connect(richGuy).transfer(jobOwner._address, liquidity);

  const spentKp3rs = initialBalance.sub(await keep3rV1.balanceOf(richGuy._address));

  return { liquidity, spentKp3rs };
}
