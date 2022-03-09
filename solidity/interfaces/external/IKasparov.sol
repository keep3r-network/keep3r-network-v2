// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKasparov {
  function governor() external view returns (address _governor);

  function work() external;

  function setKeep3r(address _keep3r) external;
}
