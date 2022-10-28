---
sidebar_position: 5
---
# Filtering Keepers
Depending on your requirements, you might allow any keeper to work your job. Otherwise you can filter keepers based on different parameters used by the [`isBondedKeeper()`](https://github.com/keep3r-network/keep3r-network-v2/blob/main/solidity/interfaces/peripherals/IKeep3rJobs.sol#L298) method.

## No access control
Accept all keepers in the system.
```js
/// @notice Confirms if the current keeper is registered, can be used for general (non critical) functions
/// @param _keeper The keeper being investigated
/// @return _isKeeper Whether the address passed as a parameter is a keeper or not
function isKeeper(address _keeper) external returns (bool _isKeeper);

function work() external {
    // checks if the called is a registered keeper
    bool isKeeper = IKeep3r(keep3r).isKeeper(msg.sender);
    require(isKeeper); 
    myContract.doSomethingForMy();
    IKeep3r(keep3r).worked(msg.sender)
}
```

## Filtered access control
Filter keepers based on the bonded amount of tokens, earned funds, and age in system. For example, a keeper might need to have `SNX` to be able to participate in the [Synthetix](https://synthetix.io/) ecosystem.

```js
/// @notice Confirms if the current keeper is registered and has a minimum bond of any asset. Should be used for protected functions
/// @param _keeper The keeper to check
/// @param _bond The bond token being evaluated
/// @param _minBond The minimum amount of bonded tokens
/// @param _earned The minimum funds earned in the keepers lifetime
/// @param _age The minimum keeper age required
/// @return _isBondedKeeper Whether the `_keeper` meets the given requirements
function isBondedKeeper(
  address _keeper,
  address _bond,
  uint256 _minBond,
  uint256 _earned,
  uint256 _age
) external returns (bool _isBondedKeeper);

function work() external {
    // checks if the caller is a registered keeper and complise with all
    // specified requirements.
    bool isKeeper = IKeep3r(keep3r).isBondedKeeper(msg.sender, ...);
    require(isKeeper); 
    myContract.doSomethingForMy();
    IKeep3r(keep3r).worked(msg.sender)
}
```