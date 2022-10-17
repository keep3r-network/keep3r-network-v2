// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4 <0.9.0;

import '../peripherals/Mintable.sol';
import '../peripherals/DustCollector.sol';
import '../../interfaces/sidechain/IKeep3rEscrow.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract Keep3rEscrow is Mintable, DustCollector, IKeep3rEscrow {
  using SafeERC20 for IERC20;

  /// @inheritdoc IKeep3rEscrow
  address public override wKP3R;

  /// @param _governance Address of governance
  /// @param _wKP3R Address of wrapped KP3R implementation
  constructor(address _governance, address _wKP3R) Mintable(_governance) {
    wKP3R = _wKP3R;
  }

  /// @inheritdoc IKeep3rEscrow
  function deposit(uint256 _amount) external override {
    IERC20(wKP3R).safeTransferFrom(msg.sender, address(this), _amount);
    emit wKP3RDeposited(wKP3R, msg.sender, _amount);
  }

  /// @inheritdoc IKeep3rEscrow
  function mint(uint256 _amount) external override onlyMinter {
    IERC20(wKP3R).safeTransfer(msg.sender, _amount);
    emit wKP3RMinted(wKP3R, msg.sender, _amount);
  }

  /// @inheritdoc IKeep3rEscrow
  function setWKP3R(address _wKP3R) external override onlyGovernance {
    if (_wKP3R == address(0)) revert ZeroAddress();
    wKP3R = _wKP3R;
    emit wKP3RSet(wKP3R);
  }
}
