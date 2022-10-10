# Disputer

Disputers are governance-approved addresses with permission to dispute keepers or jobs that may have acted in bad faith. Once a dispute has started, a slasher will be in charge of evaluating what measures to take. In the meantime, the disputed address will be unable to:

* If the disputed address is a keeper, it won't be able to: 
  * Bond or activate new assets 
  * Withdraw its unbonded assets

{% hint style="info" %}
A disputed keeper can keep working jobs until is revoked
{% endhint %}

* If the disputed address is a job, it won't be able to: 
  * Have keepers work the job
  * Withdraw liquidity or token credits from the job
  * Perform a job migration \(if any of the addresses is disputed\)

Once the slasher has acted upon the disputed address—or decided against taking actions as a result of not considering the job or keeper to have acted in bad faith—either governance or a disputer will be able to resolve the dispute.

## Disputing Keepers or Jobs

Disputes a keeper or a job.

```text
/// @notice Allows governance to create a dispute for a given keeper/job
/// @param _jobOrKeeper The address in dispute
function dispute(address _jobOrKeeper) external;
```

## Resolve a Dispute

Resolves a dispute.

```text
/// @notice Allows governance to resolve a dispute on a keeper/job
/// @param _jobOrKeeper The address cleared
function resolve(address _jobOrKeeper) external;
```

