// SPDX-License-Identifier: MIT

/*

Coded for The Keep3r Network with ♥ by

██████╗░███████╗███████╗██╗  ░██╗░░░░░░░██╗░█████╗░███╗░░██╗██████╗░███████╗██████╗░██╗░░░░░░█████╗░███╗░░██╗██████╗░
██╔══██╗██╔════╝██╔════╝██║  ░██║░░██╗░░██║██╔══██╗████╗░██║██╔══██╗██╔════╝██╔══██╗██║░░░░░██╔══██╗████╗░██║██╔══██╗
██║░░██║█████╗░░█████╗░░██║  ░╚██╗████╗██╔╝██║░░██║██╔██╗██║██║░░██║█████╗░░██████╔╝██║░░░░░███████║██╔██╗██║██║░░██║
██║░░██║██╔══╝░░██╔══╝░░██║  ░░████╔═████║░██║░░██║██║╚████║██║░░██║██╔══╝░░██╔══██╗██║░░░░░██╔══██║██║╚████║██║░░██║
██████╔╝███████╗██║░░░░░██║  ░░╚██╔╝░╚██╔╝░╚█████╔╝██║░╚███║██████╔╝███████╗██║░░██║███████╗██║░░██║██║░╚███║██████╔╝
╚═════╝░╚══════╝╚═╝░░░░░╚═╝  ░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚══╝╚═════╝░╚══════╝╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝╚═╝░░╚══╝╚═════╝░

https://defi.sucks

*/

pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/IPairManagerFactory.sol';
import './UniV3PairManager.sol';
import '@defi-wonderland/solidity-utils/solidity/contracts/Governable.sol';

/// @title Factory of Pair Managers
/// @notice This contract creates new pair managers
contract UniV3PairManagerFactory is IPairManagerFactory, Governable {
  mapping(address => address) public override pairManagers;

  constructor(address _governor) Governable(_governor) {}

  ///@inheritdoc IPairManagerFactory
  function createPairManager(address _pool) external override returns (address _pairManager) {
    if (pairManagers[_pool] != address(0)) revert AlreadyInitialized();
    _pairManager = address(new UniV3PairManager(_pool, governor));
    pairManagers[_pool] = _pairManager;
    emit PairCreated(_pool, _pairManager);
  }
}
