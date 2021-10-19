// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './interfaces/IPairFactory.sol';
import './UniV3PairManager.sol';
import './peripherals/Governable.sol';

contract UniV3PairManagerFactory is IPairFactory, Governable {
  mapping(address => address) public override pairManagers;

  constructor() Governable(msg.sender) {}

  function createPairManager(address _pool) external override returns (address _pairManager) {
    if (pairManagers[_pool] != address(0)) revert AlreadyInitialized();
    _pairManager = address(new UniV3PairManager(_pool, governance));
    pairManagers[_pool] = _pairManager;
    emit PairCreated(_pool, _pairManager);
  }
}
