// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import './peripherals/IGovernable.sol';

interface IPairFactory is IGovernable {
  //variables

  function pairManagers(address _pool) external view returns (address);

  //events
  event PairCreated(address _pool, address _pairManager);

  //errors
  error AlreadyInitialized();
  error OnlyOwner();

  //methods
  function createPairManager(address _pool) external returns (address);
}
