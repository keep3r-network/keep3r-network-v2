---
sidebar_position: 2
---

# Managing Slashers

When keepers or jobs act in bad faith, measures must be taken to keep the network pruned of ill-intended actors. To ensure this, governance has the ability to add [slashers](../slasher/README.md), which are whitelisted addresses with special permissions over keepers and jobs.

Adding a slasher.
```js
/// @notice Registers a slasher by updating the slashers mapping
function addSlasher(address _slasher) external;
```

Governance also has the ability to remove slashers.
```js
/// @notice Removes a slasher by updating the slashers mapping
function removeSlasher(address _slasher) external;
```

:::info
Governance itself can approve its own address to be a slasher
:::