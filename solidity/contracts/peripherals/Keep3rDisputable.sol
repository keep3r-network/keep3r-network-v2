// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rParameters.sol';
import './Keep3rRoles.sol';
import '../interfaces/peripherals/IKeep3rDisputable.sol';

abstract contract Keep3rDisputable is IKeep3rDisputable, Keep3rAccountance, Keep3rRoles {
  /**
   * @notice allows governance to create a dispute for a given keeper
   * @param _jobOrKeeper the address in dispute
   */
  function dispute(address _jobOrKeeper) external override onlyDisputerOrGovernance {
    if (disputes[_jobOrKeeper]) revert AlreadyDisputed();
    disputes[_jobOrKeeper] = true;
    emit Dispute(_jobOrKeeper);
  }

  /**
   * @notice allows governance to resolve a dispute on a keeper
   * @param _jobOrKeeper the address cleared
   */
  function resolve(address _jobOrKeeper) external override onlyDisputerOrGovernance {
    if (!disputes[_jobOrKeeper]) revert NotDisputed();
    disputes[_jobOrKeeper] = false;
    emit Resolve(_jobOrKeeper);
  }
}
