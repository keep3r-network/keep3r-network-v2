// SPDX-License-Identifier: MIT

/*

Coded for The Keep3r Network with ♥ by

██████╗░███████╗███████╗██╗░░░██╗░░░░░░░██╗░█████╗░███╗░░██╗██████╗░███████╗██████╗░██╗░░░░░░█████╗░███╗░░██╗██████╗░
██╔══██╗██╔════╝██╔════╝██║░░░██║░░██╗░░██║██╔══██╗████╗░██║██╔══██╗██╔════╝██╔══██╗██║░░░░░██╔══██╗████╗░██║██╔══██╗
██║░░██║█████╗░░█████╗░░██║░░░╚██╗████╗██╔╝██║░░██║██╔██╗██║██║░░██║█████╗░░██████╔╝██║░░░░░███████║██╔██╗██║██║░░██║
██║░░██║██╔══╝░░██╔══╝░░██║░░░░████╔═████║░██║░░██║██║╚████║██║░░██║██╔══╝░░██╔══██╗██║░░░░░██╔══██║██║╚████║██║░░██║
██████╔╝███████╗██║░░░░░██║░░░░╚██╔╝░╚██╔╝░╚█████╔╝██║░╚███║██████╔╝███████╗██║░░██║███████╗██║░░██║██║░╚███║██████╔╝
╚═════╝░╚══════╝╚═╝░░░░░╚═╝░░░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚══╝╚═════╝░╚══════╝╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝╚═╝░░╚══╝╚═════╝░

https://defi.sucks

Commit hash: b18e2940310077e04ec08b3026dc92e441fb08ef

*/

pragma solidity >=0.8.4 <0.9.0;

import '../peripherals/Mintable.sol';
import '../../interfaces/sidechain/IKeep3rEscrow.sol';
import '@defi-wonderland/solidity-utils/solidity/contracts/DustCollector.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract Keep3rEscrow is Mintable, DustCollector, IKeep3rEscrow {
  using SafeERC20 for IERC20;

  /// @inheritdoc IKeep3rEscrow
  address public override wKP3R;

  /// @param _governor Address of governor
  /// @param _wKP3R Address of wrapped KP3R implementation
  constructor(address _governor, address _wKP3R) Mintable(_governor) {
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
  function setWKP3R(address _wKP3R) external override onlyGovernor {
    if (_wKP3R == address(0)) revert ZeroAddress();
    wKP3R = _wKP3R;
    emit wKP3RSet(wKP3R);
  }
}
