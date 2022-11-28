// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/sidechain/Keep3rSidechain.sol';

contract Keep3rSidechainForTest is Keep3rSidechain {
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _governance,
    address _keep3rHelper,
    address _wrappedKP3R,
    address _keep3rEscrow
  ) Keep3rSidechain(_governance, _keep3rHelper, _wrappedKP3R, _keep3rEscrow) {}

  function setJobLiquidity(address _job, address _liquidity) external {
    _jobLiquidities[_job].add(_liquidity);
  }
}
