## `IKeep3rV1`






### `KPRH() → address` (external)





### `delegates(address _delegator) → address` (external)





### `checkpoints(address _account, uint32 _checkpoint) → struct IKeep3rV1.Checkpoint` (external)





### `numCheckpoints(address _account) → uint32` (external)





### `DOMAIN_TYPEHASH() → bytes32` (external)





### `DOMAINSEPARATOR() → bytes32` (external)





### `DELEGATION_TYPEHASH() → bytes32` (external)





### `PERMIT_TYPEHASH() → bytes32` (external)





### `nonces(address _user) → uint256` (external)





### `BOND() → uint256` (external)





### `UNBOND() → uint256` (external)





### `LIQUIDITYBOND() → uint256` (external)





### `FEE() → uint256` (external)





### `BASE() → uint256` (external)





### `ETH() → address` (external)





### `bondings(address _user, address _bonding) → uint256` (external)





### `canWithdrawAfter(address _user, address _bonding) → uint256` (external)





### `pendingUnbonds(address _keeper, address _bonding) → uint256` (external)





### `pendingbonds(address _keeper, address _bonding) → uint256` (external)





### `bonds(address _keeper, address _bonding) → uint256` (external)





### `votes(address _delegator) → uint256` (external)





### `firstSeen(address _keeper) → uint256` (external)





### `disputes(address _keeper) → bool` (external)





### `lastJob(address _keeper) → uint256` (external)





### `workCompleted(address _keeper) → uint256` (external)





### `jobs(address _job) → bool` (external)





### `credits(address _job, address _credit) → uint256` (external)





### `liquidityProvided(address _provider, address _liquidity, address _job) → uint256` (external)





### `liquidityUnbonding(address _provider, address _liquidity, address _job) → uint256` (external)





### `liquidityAmountsUnbonding(address _provider, address _liquidity, address _job) → uint256` (external)





### `jobProposalDelay(address _job) → uint256` (external)





### `liquidityApplied(address _provider, address _liquidity, address _job) → uint256` (external)





### `liquidityAmount(address _provider, address _liquidity, address _job) → uint256` (external)





### `keepers(address _keeper) → bool` (external)





### `blacklist(address _keeper) → bool` (external)





### `keeperList(uint256 _index) → address` (external)





### `jobList(uint256 _index) → address` (external)





### `governance() → address` (external)





### `pendingGovernance() → address` (external)





### `liquidityAccepted(address _liquidity) → bool` (external)





### `liquidityPairs(uint256 _index) → address` (external)





### `getCurrentVotes(address _account) → uint256` (external)





### `addCreditETH(address _job)` (external)





### `addCredit(address _credit, address _job, uint256 _amount)` (external)





### `addVotes(address _voter, uint256 _amount)` (external)





### `removeVotes(address _voter, uint256 _amount)` (external)





### `addKPRCredit(address _job, uint256 _amount)` (external)





### `approveLiquidity(address _liquidity)` (external)





### `revokeLiquidity(address _liquidity)` (external)





### `pairs() → address[]` (external)





### `addLiquidityToJob(address _liquidity, address _job, uint256 _amount)` (external)





### `applyCreditToJob(address _provider, address _liquidity, address _job)` (external)





### `unbondLiquidityFromJob(address _liquidity, address _job, uint256 _amount)` (external)





### `removeLiquidityFromJob(address _liquidity, address _job)` (external)





### `mint(uint256 _amount)` (external)





### `burn(uint256 _amount)` (external)





### `worked(address _keeper)` (external)





### `receipt(address _credit, address _keeper, uint256 _amount)` (external)





### `receiptETH(address _keeper, uint256 _amount)` (external)





### `addJob(address _job)` (external)





### `getJobs() → address[]` (external)





### `removeJob(address _job)` (external)





### `setKeep3rHelper(address _keep3rHelper)` (external)





### `setGovernance(address _governance)` (external)





### `acceptGovernance()` (external)





### `isKeeper(address _keeper) → bool` (external)





### `isMinKeeper(address _keeper, uint256 _minBond, uint256 _earned, uint256 _age) → bool` (external)





### `isBondedKeeper(address _keeper, address _bond, uint256 _minBond, uint256 _earned, uint256 _age) → bool` (external)





### `bond(address _bonding, uint256 _amount)` (external)





### `getKeepers() → address[]` (external)





### `activate(address _bonding)` (external)





### `unbond(address _bonding, uint256 _amount)` (external)





### `slash(address _bonded, address _keeper, uint256 _amount)` (external)





### `withdraw(address _bonding)` (external)





### `dispute(address _keeper)` (external)





### `revoke(address _keeper)` (external)





### `resolve(address _keeper)` (external)





### `permit(address _owner, address _spender, uint256 _amount, uint256 _deadline, uint8 _v, bytes32 _r, bytes32 _s)` (external)






### `DelegateChanged(address _delegator, address _fromDelegate, address _toDelegate)`





### `DelegateVotesChanged(address _delegate, uint256 _previousBalance, uint256 _newBalance)`





### `SubmitJob(address _job, address _liquidity, address _provider, uint256 _block, uint256 _credit)`





### `ApplyCredit(address _job, address _liquidity, address _provider, uint256 _block, uint256 _credit)`





### `RemoveJob(address _job, address _liquidity, address _provider, uint256 _block, uint256 _credit)`





### `UnbondJob(address _job, address _liquidity, address _provider, uint256 _block, uint256 _credit)`





### `JobAdded(address _job, uint256 _block, address _governance)`





### `JobRemoved(address _job, uint256 _block, address _governance)`





### `KeeperWorked(address _credit, address _job, address _keeper, uint256 _block, uint256 _amount)`





### `KeeperBonding(address _keeper, uint256 _block, uint256 _active, uint256 _bond)`





### `KeeperBonded(address _keeper, uint256 _block, uint256 _activated, uint256 _bond)`





### `KeeperUnbonding(address _keeper, uint256 _block, uint256 _deactive, uint256 _bond)`





### `KeeperUnbound(address _keeper, uint256 _block, uint256 _deactivated, uint256 _bond)`





### `KeeperSlashed(address _keeper, address _slasher, uint256 _block, uint256 _slash)`





### `KeeperDispute(address _keeper, uint256 _block)`





### `KeeperResolved(address _keeper, uint256 _block)`





### `TokenCreditAddition(address _credit, address _job, address _creditor, uint256 _block, uint256 _amount)`






### `Checkpoint`


uint32 fromBlock


uint256 votes



