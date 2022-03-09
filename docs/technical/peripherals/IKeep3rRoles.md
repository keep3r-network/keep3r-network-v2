## `IKeep3rRoles`

Manages the Keep3r specific roles




### `slashers(address _slasher) → bool _isSlasher` (external)

Tracks whether the address is a slasher or not




### `disputers(address _disputer) → bool _isDisputer` (external)

Tracks whether the address is a disputer or not




### `addSlasher(address _slasher)` (external)

Registers a slasher by updating the slashers mapping



### `removeSlasher(address _slasher)` (external)

Removes a slasher by updating the slashers mapping



### `addDisputer(address _disputer)` (external)

Registers a disputer by updating the disputers mapping



### `removeDisputer(address _disputer)` (external)

Removes a disputer by updating the disputers mapping




### `SlasherAdded(address _slasher)`

Emitted when a slasher is added




### `SlasherRemoved(address _slasher)`

Emitted when a slasher is removed




### `DisputerAdded(address _disputer)`

Emitted when a disputer is added




### `DisputerRemoved(address _disputer)`

Emitted when a disputer is removed






