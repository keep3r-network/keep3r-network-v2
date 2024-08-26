// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../../contracts/sidechain/Keep3rSidechain.sol';

contract Keep3rSidechainForTestnet is Keep3rSidechain {
  constructor(
    address _governor,
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3rSidechain(_governor, _keep3rHelper, _keep3rV1, _keep3rV1Proxy) {
    bondTime = 0; // allows keepers to instantly register
    unbondTime = 0; // allows keepers & jobOwners to instantly withdraw funds
    liquidityMinimum = 1; // allows job providers to add low liquidity
    rewardPeriodTime = 1 days; // reduces twap calculation period
    inflationPeriod = 5 days; // increases credit minting
  }
}
