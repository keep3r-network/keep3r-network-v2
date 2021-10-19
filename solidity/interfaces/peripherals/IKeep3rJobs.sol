// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

interface IKeep3rJobFundableCredits {
  // events
  event AddCredit(address indexed _job, address indexed _token, address indexed _creditor, uint256 _block, uint256 _amount);
  event JobTokenCreditWithdrawal(
    address indexed _job,
    address indexed _token,
    uint256 _amount,
    address _sender,
    address indexed _receiver,
    uint256 _remainingTokenCredits
  );

  // errors
  error TokenUnavailable();
  error JobTokenCreditsLocked();
  error InsufficientJobTokenCredits();

  // variables
  function jobTokenCreditsAddedAt(address _liquidity, address _job) external view returns (uint256);

  // methods
  function addTokenCreditsToJob(
    address _token,
    address _job,
    uint256 _amount
  ) external;

  function withdrawTokenCreditsFromJob(
    address _token,
    address _job,
    uint256 _amount,
    address _receiver
  ) external;
}

interface IKeep3rJobFundableLiquidity {
  // events
  event LiquidityApproval(address indexed _liquidity);
  event LiquidityRevocation(address indexed _liquidity);
  event LiquidityAddition(address indexed _job, address indexed _liquidity, address indexed _provider, uint256 _timestamp, uint256 _credit);
  event LiquidityWithdrawal(address indexed _job, address indexed _liquidity, address indexed _sender, uint256 _timestamp, uint256 _credit);
  event JobCreditsUpdated(address indexed _job, uint256 _rewardedAt, uint256 _currentCredits);

  // errors
  error LiquidityPairInvalid();
  error LiquidityPairApproved();
  error LiquidityPairUnexistent();
  error LiquidityPairUnapproved();
  error JobLiquidityUnexistent();
  error JobLiquidityInsufficient();
  error JobLiquidityLessThanMin();

  // structs
  struct TickCache {
    int56 current;
    int56 difference;
    uint256 period;
  }

  // variables
  function approvedLiquidities() external view returns (address[] memory);

  function liquidityAmount(address _job, address _liquidity) external view returns (uint256);

  function rewardedAt(address _job) external view returns (uint256);

  function workedAt(address _job) external view returns (uint256);

  function forceLiquidityCreditsToJob(address _job, uint256 _amount) external;

  function jobLiquidityCredits(address _job) external view returns (uint256 _amount);

  function jobPeriodCredits(address _job) external view returns (uint256 _amount);

  function totalJobCredits(address _job) external view returns (uint256 _amount);

  function quoteLiquidity(address _liquidity, uint256 _amount) external view returns (uint256 _periodCredits);

  function observeLiquidity(address _liquidity) external view returns (TickCache memory _tickCache);

  // methods

  function approveLiquidity(address _liquidity) external;

  function revokeLiquidity(address _liquidity) external;

  function addLiquidityToJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external;

  function unbondLiquidityFromJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external;

  function withdrawLiquidityFromJob(address _job, address _liquidity) external;
}

interface IKeep3rJobManager {
  // events
  event JobAddition(address indexed _job, uint256 _block, address _governance);
  event JobRemoval(address indexed _job, uint256 _block, address _governance);

  // errors
  error JobAlreadyAdded();
  error JobUnexistent();

  // methods
  function addJob(address _job) external;

  function removeJob(address _job) external;
}

interface IKeep3rJobWorkable {
  // events
  /// @notice Worked a job
  event KeeperWork(
    address indexed _credit,
    address indexed _job,
    address indexed _keeper,
    uint256 _block,
    uint256 _amount,
    uint256 _remainingCredits
  );

  // errors
  error JobUnapproved();
  error InsufficientFunds();

  // methods
  function isKeeper(address _keeper) external returns (bool);

  function isMinKeeper(
    address _keeper,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age
  ) external returns (bool);

  function isBondedKeeper(
    address _keeper,
    address _bond,
    uint256 _minBond,
    uint256 _earned,
    uint256 _age
  ) external returns (bool);

  function worked(address _keeper) external;

  function bondedPayment(address _keeper, uint256 _amount) external;

  function directTokenPayment(
    address _token,
    address _keeper,
    uint256 _amount
  ) external;
}

interface IKeep3rJobOwnership {
  // events
  event JobOwnershipChange(address indexed _job, address indexed _owner, address indexed _pendingOwner);
  event JobOwnershipAssent(address indexed _job, address indexed _previousOwner, address indexed _newOwner);

  // errors
  error OnlyJobOwner();
  error OnlyPendingJobOwner();

  // variables
  function jobOwner(address _job) external view returns (address _owner);

  function jobPendingOwner(address _job) external view returns (address _pendingOwner);

  // methods
  function changeJobOwnership(address _job, address _newOwner) external;

  function acceptJobOwnership(address _job) external;
}

interface IKeep3rJobMigration {
  // events
  event JobMigrationRequested(address _fromJob, address _toJob);
  event JobMigrationSuccessful(address _fromJob, address _toJob);

  // errors
  error JobMigrationImpossible();
  error JobMigrationUnavailable();
  error JobMigrationLocked();

  // variables
  function pendingJobMigrations(address _fromJob) external view returns (address _toJob);

  // methods
  function migrateJob(address _fromJob, address _toJob) external;

  function acceptJobMigration(address _fromJob, address _toJob) external;
}

interface IKeep3rJobDisputable is IKeep3rJobFundableCredits, IKeep3rJobFundableLiquidity {
  // events
  event JobSlash(address _job);
  event JobSlashToken(address _job, address _token, uint256 _amount);
  event JobSlashLiquidity(address _job, address _liquidity, uint256 _amount);

  // errors
  error JobTokenUnexistent();
  error JobTokenInsufficient();

  // methods
  function slashJob(address _job) external;

  function slashTokenFromJob(
    address _job,
    address _token,
    uint256 _amount
  ) external;

  function slashLiquidityFromJob(
    address _job,
    address _liquidity,
    uint256 _amount
  ) external;
}

// solhint-disable-next-line no-empty-blocks
interface IKeep3rJobs is IKeep3rJobOwnership, IKeep3rJobDisputable, IKeep3rJobMigration, IKeep3rJobManager, IKeep3rJobWorkable {

}
