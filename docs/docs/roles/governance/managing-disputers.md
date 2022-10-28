---
sidebar_position: 3
---

# Managing Disputers

When a keeper or a job is detected behaving strangely, actions must be taken to pause and study whether their behaviour is harmful to the network or not. To ensure these cases are frozen and inspected, governance has the ability to add [disputers](../disputer/README.md), which are whitelisted addresses with the ability to dispute jobs and keepers, forbidding them to exercise common actions like a job being worked. A dispute also signals the slashers that there's a potential bad actor in the network, and the slasher will decide what measures to take.


Adding a disputer.
```js
/// @notice Registers a disputer by updating the disputers mapping
function addDisputer(address _disputer) external;
```

Removing a disputer.
```js
/// @notice Removes a disputer by updating the disputers mapping
function removeDisputer(address _disputer) external;
```

:::info
Governance itself can approve its own address to be a disputer
:::