// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/IKeep3r.sol';

contract BasicJob {
  error KeeperNotValid();

  address public keep3r;
  uint256 public nonce;
  uint256[] public array;

  constructor(address _keep3r) {
    keep3r = _keep3r;
  }

  function work() external upkeep {}

  function workHard(uint256 _howHard) external upkeep {
    for (uint256 i = nonce; i < _howHard; i++) {
      nonce++;
    }
  }

  function workRefund(uint256 _howHard) external upkeep {
    for (uint256 i; i < _howHard; i++) {
      array.push(i);
    }

    while (array.length > 0) {
      array.pop();
    }
  }

  modifier upkeep() {
    if (!IKeep3r(keep3r).isKeeper(msg.sender)) revert KeeperNotValid();
    _;
    IKeep3r(keep3r).worked(msg.sender);
  }
}
