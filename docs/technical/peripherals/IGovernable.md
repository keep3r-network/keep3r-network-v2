## `IGovernable`

Manages the governance role




### `governance() → address _governance` (external)

Stores the governance address




### `pendingGovernance() → address _pendingGovernance` (external)

Stores the pendingGovernance address




### `setGovernance(address _governance)` (external)

Proposes a new address to be governance




### `acceptGovernance()` (external)

Changes the governance from the current governance to the previously proposed address




### `GovernanceSet(address _governance)`

Emitted when pendingGovernance accepts to be governance




### `GovernanceProposal(address _pendingGovernance)`

Emitted when a new governance is proposed






