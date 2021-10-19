// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rKeeperFundable.sol';
import '../Keep3rDisputable.sol';
import '../../interfaces/external/IKeep3rV1.sol';
import '../../interfaces/peripherals/IKeep3rKeepers.sol';

abstract contract Keep3rKeeperDisputable is IKeep3rKeeperDisputable, Keep3rDisputable, Keep3rKeeperFundable {
  using EnumerableSet for EnumerableSet.AddressSet;
  using SafeERC20 for IERC20;

  /**
   * @notice allows governance to slash a keeper based on a dispute
   * @param _bonded the asset being slashed
   * @param _keeper the address being slashed
   * @param _amount the amount being slashed
   */
  function slash(
    address _bonded,
    address _keeper,
    uint256 _amount
  ) public override nonReentrant onlyGovernance {
    _slash(_bonded, _keeper, _amount);
    emit KeeperSlash(_keeper, msg.sender, block.number, _amount);
  }

  /**
   * @notice blacklists a keeper from participating in the network
   * @param _keeper the address being slashed
   */
  function revoke(address _keeper) external override nonReentrant onlyGovernance {
    if (!disputes[_keeper]) revert NotDisputed();
    _keepers.remove(_keeper);
    _slash(keep3rV1, _keeper, bonds[_keeper][keep3rV1]);
    emit KeeperRevoke(_keeper, msg.sender, block.number);
  }

  function _slash(
    address _bonded,
    address _keeper,
    uint256 _amount
  ) internal {
    if (_bonded != keep3rV1) {
      try IERC20(_bonded).transfer(governance, _amount) returns (bool) {} catch (bytes memory) {}
    }
    bonds[_keeper][_bonded] -= _amount;
  }
}
