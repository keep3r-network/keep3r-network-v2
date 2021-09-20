// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

contract ProxyForTest {
  error CallError();

  function call(address _target, bytes memory _data) external {
    // solhint-disable-next-line avoid-low-level-calls
    (bool success, ) = _target.call(_data);
    if (!success) revert CallError();
  }
}
