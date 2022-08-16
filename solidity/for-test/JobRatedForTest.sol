// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/IKeep3r.sol';
import '../interfaces/sidechain/IKeep3rJobWorkableRated.sol';

contract JobRatedForTest {
  error InvalidKeeper();
  address public keep3r;
  uint256 public nonce;
  uint256 public usdPerGasUnit = 1;

  constructor(address _keep3r) {
    keep3r = _keep3r;
  }

  function work() external {
    if (!IKeep3r(keep3r).isKeeper(msg.sender)) revert InvalidKeeper();

    for (uint256 i = 0; i < 1000; i++) {
      nonce++;
    }

    IKeep3rJobWorkableRated(keep3r).worked(msg.sender, usdPerGasUnit);
  }

  function workHard(uint256 _factor) external {
    if (!IKeep3r(keep3r).isKeeper(msg.sender)) revert InvalidKeeper();

    for (uint256 i = 0; i < 1000 * _factor; i++) {
      nonce++;
    }

    IKeep3rJobWorkableRated(keep3r).worked(msg.sender, usdPerGasUnit);
  }
}
