// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7 <0.9.0;

import './libraries/Keep3rLibrary.sol';
import './interfaces/IKeep3r.sol';
import './interfaces/external/IKeep3rV1.sol';
import './interfaces/IKeep3rHelper.sol';

import '@openzeppelin/contracts/utils/math/Math.sol';

contract Keep3rHelper is IKeep3rHelper {
  address public immutable keep3rV2;

  constructor(address _keep3rV2) {
    keep3rV2 = _keep3rV2;
  }

  address public constant override KP3R = 0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44;
  address public constant override KP3R_WETH_POOL = 0x11B7a6bc0259ed6Cf9DB8F499988F9eCc7167bf5;

  uint256 public constant override MIN = 11;
  uint256 public constant override MAX = 12;
  uint256 public constant override BASE = 10;
  uint256 public constant override BOOST_BASE = 10000;
  uint256 public constant override TARGETBOND = 200 ether;

  function quote(uint256 _eth) public view override returns (uint256 _amountOut) {
    bool _isKP3RToken0 = Keep3rLibrary.isKP3RToken0(KP3R, KP3R_WETH_POOL);
    int56 _tickDifference = IKeep3r(keep3rV2).observeLiquidity(KP3R_WETH_POOL).difference;
    _tickDifference = _isKP3RToken0 ? _tickDifference : -_tickDifference;
    uint256 _tickInterval = IKeep3r(keep3rV2).rewardPeriodTime();
    _amountOut = Keep3rLibrary.getQuoteAtTick(_eth, _tickDifference, _tickInterval);
  }

  function bonds(address _keeper) public view override returns (uint256) {
    return IKeep3r(keep3rV2).bonds(_keeper, KP3R);
  }

  function getRewardAmountFor(address _keeper, uint256 _gasUsed) public view override returns (uint256 _kp3r) {
    uint256 _quote = quote((_gasUsed) * _getBasefee());
    uint256 _min = (_quote * MIN) / BASE;
    uint256 _boost = (_quote * MAX) / BASE;
    uint256 _bonds = Math.min(bonds(_keeper), TARGETBOND);
    return Math.max(_min, (_boost * _bonds) / TARGETBOND);
  }

  function getRewardAmount(uint256 _gasUsed) external view override returns (uint256) {
    // solhint-disable-next-line avoid-tx-origin
    return getRewardAmountFor(tx.origin, _gasUsed);
  }

  function getRewardBoostFor(uint256 _bonds) external view override returns (uint256 _rewardBoost, uint256 _boostBase) {
    uint256 _min = (BOOST_BASE * MIN) / BASE;
    uint256 _boost = (BOOST_BASE * MAX) / BASE;
    _bonds = Math.min(_bonds, TARGETBOND);
    uint256 _cap = Math.max(_min, (_boost * _bonds) / TARGETBOND);
    _rewardBoost = _cap * _getBasefee();
    _boostBase = BOOST_BASE;
  }

  function _getBasefee() internal view virtual returns (uint256) {
    return block.basefee;
  }
}
