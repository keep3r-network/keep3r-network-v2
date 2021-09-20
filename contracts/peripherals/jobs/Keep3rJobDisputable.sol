// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import './Keep3rJobFundableCredits.sol';
import './Keep3rJobFundableLiquidity.sol';
import '../Keep3rDisputable.sol';

abstract contract Keep3rJobDisputable is IKeep3rJobDisputable, Keep3rDisputable, Keep3rJobFundableCredits, Keep3rJobFundableLiquidity {
  using EnumerableSet for EnumerableSet.AddressSet;
  using SafeERC20 for IERC20;

  /**
   * @notice allows governance to slash a job
   * @param _job the address being slashed
   */
  function slashJob(address _job) external override nonReentrant onlySlasherOrGovernance {
    if (!disputes[_job]) revert NotDisputed();

    // slash job tokens and token credits
    uint256 _index = 0;
    while (_index < _jobTokens[_job].length()) {
      address _token = _jobTokens[_job].at(_index);

      // make low level call ir order to avoid reverting
      // solhint-disable-next-line avoid-low-level-calls
      try IERC20(_token).transfer(governance, jobTokenCredits[_job][_token]) {
        jobTokenCredits[_job][_token] = 0;
        _jobTokens[_job].remove(_token);
      } catch {
        _index++;
      }
    }

    // slash job liquidities
    while (_jobLiquidities[_job].length() > 0) {
      address _liquidity = _jobLiquidities[_job].at(0);

      IERC20(_liquidity).safeTransfer(governance, liquidityAmount[_job][_liquidity]);
      liquidityAmount[_job][_liquidity] = 0;
      _jobLiquidities[_job].remove(_liquidity);
    }

    // slash job liquidity credits
    _jobLiquidityCredits[_job] = 0;
    _jobPeriodCredits[_job] = 0;
    disputes[_job] = false;

    // emit event
    emit JobSlash(_job);
  }

  /**
   * @notice allows governance to slash a job specific token
   * @param _job the address being slashed
   * @param _token the address of the token being slashed
   * @param _amount amount of token to slash
   */
  function slashTokenFromJob(
    address _job,
    address _token,
    uint256 _amount
  ) external override nonReentrant onlySlasherOrGovernance {
    if (!disputes[_job]) revert NotDisputed();
    if (!_jobTokens[_job].contains(_token)) revert JobTokenUnexistent();
    if (jobTokenCredits[_job][_token] < _amount) revert JobTokenInsufficient();

    // slash job token and token credits
    IERC20(_token).safeTransfer(governance, _amount);
    jobTokenCredits[_job][_token] -= _amount;
    if (jobTokenCredits[_job][_token] == 0) {
      _jobTokens[_job].remove(_token);
    }

    // emit event
    emit JobSlashToken(_job, _token, _amount);
  }

  /**
   * @notice allows governance to slash a job specific token
   * @param _job the address being slashed
   * @param _liquidity the address of the liquidity being slashed
   * @param _amount amount of token to slash
   */
  function slashLiquidityFromJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external override onlySlasherOrGovernance {
    if (!disputes[_job]) revert NotDisputed();

    _unbondLiquidityFromJob(_job, _liquidity, _amount);
    IERC20(_liquidity).safeTransfer(governance, _amount);
    emit JobSlashLiquidity(_job, _liquidity, _amount);
  }
}
