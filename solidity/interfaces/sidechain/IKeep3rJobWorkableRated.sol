// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rJobWorkableRated {
  error Deprecated();

  function worked(address _keeper, uint256 _usdPerGasUnit) external;
}
