// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/Keep3r.sol';

contract Keep3rForTest is Keep3r {
  constructor(
    address _governance,
    address _keep3rHelper,
    address _keep3rV1,
    address _keep3rV1Proxy
  ) Keep3r(_governance, _keep3rHelper, _keep3rV1, _keep3rV1Proxy) {}
}
