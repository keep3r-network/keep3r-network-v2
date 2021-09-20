// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IKeep3rHelper {
  // variables
  // solhint-disable func-name-mixedcase
  function KP3R() external view returns (address);

  function KP3R_WETH_POOL() external view returns (address);

  function MIN() external view returns (uint256);

  function MAX() external view returns (uint256);

  function BASE() external view returns (uint256);

  function BOOST_BASE() external view returns (uint256);

  function TARGETBOND() external view returns (uint256);

  // methods
  // solhint-enable func-name-mixedcase
  function quote(uint256 _eth) external view returns (uint256 _amountOut);

  function bonds(address _keeper) external view returns (uint256);

  function getRewardAmountFor(address _origin, uint256 _initialGas) external view returns (uint256);

  function getRewardBoostFor(uint256 _bonds) external view returns (uint256 _rewardBoost, uint256 _boostBase);

  function getRewardAmount(uint256 _initialGas) external view returns (uint256);
}
