---
sidebar_position: 2
---

# Create a new Job

1. Create the Job contract:
```js
contract MyJob {
  IMyMainContract myMainContract; // instance of main contract

  // Modifier in charge of verifying if the caller is a registered keeper as well as 
  // rewarding them with an amount of KP3R equal to their gas spent + premium.
  modifier validateAndPayKeeper(address _keeper) {
    if (!IKeep3r(keep3r).isKeeper(_keeper)) revert KeeperNotValid();
    _;
    IKeep3r(keep3r).worked(_keeper); // Pays the keeper for the work.
  }

  // Here we will call the main function we want keepers to execute for us.
  function work() external validateAndPayKeeper(msg.sender) {
    myMainContract.doSomethingForMe();
  }

  // Returns a boolean that indicates if a job is workable or not.
  function workable() public returns (bool) {
    // Some logic...
  }
}
```
You can see how easy it is to write a job contract that will later be added to the Keep3r Network for keepers to work.

2. Deploy contract.

3. Now that we have our Job contract deployed, we need to add it to the Keep3r Network so keepers can start working it.   
To do so, we need to go to the [Keep3r V2 contract](https://etherscan.io/address/0xeb02addCfD8B773A5FFA6B9d1FE99c566f8c44CC#writeContract#F6) and call the `addJob(address)` method passing our newly deployed Job address.
```js
/// @notice Allows any caller to add a new job
/// @param _job Address of the contract for which work should be performed
function addJob(address _job) external;
```

4. Assign credits to the job to act as rewards for keepers. Read our [managing credits](./managing-credits) section to learn how to do it.

------------------

That concludes the steps to create a new Job and leave it up and running on the Keep3r network. Please remember that jobs could run out of credits preventing keepers from working it. So now that the job is running, the only thing left is to monitor it and avoid running out of credits.


:::info
We always recommend writing a script (ts, js, whatever language you like) as an example of how to work your job. Keepers will have an easier way to add your job to their bots and scripts.
:::