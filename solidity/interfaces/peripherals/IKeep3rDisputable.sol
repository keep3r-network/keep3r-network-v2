// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rDisputable {
  event Dispute(address _jobOrKeeper);
  event Resolve(address _jobOrKeeper);

  error AlreadyDisputed();
  error NotDisputed();

  function dispute(address _jobOrKeeper) external;

  function resolve(address _jobOrKeeper) external;
}
