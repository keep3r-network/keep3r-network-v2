// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract BridgeForTest is ERC20 {
  address public immutable kp3r;

  constructor(address _kp3r) ERC20('Wrapped KP3R', 'wKP3R') {
    kp3r = _kp3r;
  }

  function bridge(uint256 _amount) external {
    IERC20(kp3r).transferFrom(msg.sender, address(this), _amount);
    _mint(msg.sender, _amount);
  }

  function bridgeBack(uint256 _amount) external {
    _burn(msg.sender, _amount);
    IERC20(kp3r).transfer(msg.sender, _amount);
  }
}
