// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rJobOwnership.sol';
import '../Keep3rAccountance.sol';
import '../Keep3rParameters.sol';
import '../../interfaces/peripherals/IKeep3rJobs.sol';
import '../../interfaces/external/IKeep3rV1.sol';

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

abstract contract Keep3rJobFundableCredits is IKeep3rJobFundableCredits, ReentrancyGuard, Keep3rJobOwnership, Keep3rParameters {
  using EnumerableSet for EnumerableSet.AddressSet;
  using SafeERC20 for IERC20;

  uint256 internal constant _WITHDRAW_TOKENS_COOLDOWN = 1 minutes;
  /// @notice last block were tokens were added to the job [job => token => blockTimestamp]
  mapping(address => mapping(address => uint256)) public override jobTokenCreditsAddedAt;

  /**
   * @notice Add credit to a job to be paid out for work
   * @param _token the credit being assigned to the job
   * @param _job the job being credited
   * @param _amount the amount of credit being added to the job
   */
  function addTokenCreditsToJob(
    address _token,
    address _job,
    uint256 _amount
  ) external override nonReentrant {
    if (!_jobs.contains(_job)) revert JobUnavailable();
    // KP3R shouldn't be used for direct token payments
    if (_token == keep3rV1) revert TokenUnavailable();
    uint256 _before = IERC20(_token).balanceOf(address(this));
    IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    uint256 _received = IERC20(_token).balanceOf(address(this)) - _before;
    uint256 _fee = (_received * FEE) / BASE;
    jobTokenCredits[_job][_token] += _received - _fee;
    jobTokenCreditsAddedAt[_job][_token] = block.timestamp;
    IERC20(_token).safeTransfer(governance, _fee);
    _jobTokens[_job].add(_token);

    emit AddCredit(_job, _token, msg.sender, block.number, _received);
  }

  function withdrawTokenCreditsFromJob(
    address _token,
    address _job,
    uint256 _amount,
    address _receiver
  ) external override nonReentrant onlyJobOwner(_job) {
    if (block.timestamp <= jobTokenCreditsAddedAt[_job][_token] + _WITHDRAW_TOKENS_COOLDOWN) revert JobTokenCreditsLocked();
    if (jobTokenCredits[_job][_token] < _amount) revert InsufficientJobTokenCredits();

    jobTokenCredits[_job][_token] -= _amount;
    IERC20(_token).safeTransfer(_receiver, _amount);

    if (jobTokenCredits[_job][_token] == 0) {
      _jobTokens[_job].remove(_token);
    }

    emit JobTokenCreditWithdrawal(_job, _token, _amount, msg.sender, _receiver, jobTokenCredits[_job][_token]);
  }
}
