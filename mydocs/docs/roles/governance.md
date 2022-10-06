# Governance

Keep3r Governance by design has a low overhead, it is not meant to be protocol intensive.

The tasks governance has are:

* Managing slashers and disputers
* Managing protocol parameters
* Managing approved liquidities
* Force-minting credits to a job

The focus of governance, however, is mainly put on reviewing jobs, and if absolutely required in mitigating disputes or blacklisting keepers.

## Managing Slashers

When keepers or jobs act in bad faith, measures must be taken to keep the network pruned of ill-intended actors. To ensure this, governance has the ability to add slashers, which are whitelisted addresses with special permissions over keepers and jobs.

Adding a slasher.

```text
/// @notice Registers a slasher by updating the slashers mapping
function addSlasher(address _slasher) external;
```

Governance also has the ability to remove slashers.

```text
/// @notice Removes a slasher by updating the slashers mapping
function removeSlasher(address _slasher) external;
```

> Governance itself can approve its own address to be a slasher

## Managing Disputers

When a keeper or a job is detected behaving strangely, actions must be taken to pause and study whether their behaviour is harmful to the network or not. To ensure these cases are frozen and inspected, governance has the ability to add disputers, which are whitelisted addresses with the ability to dispute jobs and keepers, forbidding them to exercise common actions like work a job or have a keeper work its job. A dispute also signals the slashers that there's a potential bad actor in the network, and the slasher will decide what measures to take.

Adding a disputer.

```text
/// @notice Registers a disputer by updating the disputers mapping
function addDisputer(address _disputer) external;
```

Removing a disputer.

```text
/// @notice Removes a disputer by updating the disputers mapping
function removeDisputer(address _disputer) external;
```

> Governance itself can approve its own address to be a disputer

## Managing Protocol Parameters

There are certain protocol-specific parameters that can be changed by governance to ensure the correct functioning of the network. These parameters range from bonding time to the addresses of contracts that interact with Keep3rV2.

### **Bond time**

```text
/// @notice Sets the bond time required to activate as a keeper
/// @param _bond The new bond time
function setBondTime(uint256 _bond) external;
```

### **Unbond Time**

```text
/// @notice Sets the unbond time required unbond what has been bonded
/// @param _unbond The new unbond time
function setUnbondTime(uint256 _unbond) external;
```

### **Minimum Liquidity**

```text
/// @notice Sets the minimum amount of liquidity required to fund a job
/// @param _liquidityMinimum The new minimum amount of liquidity
function setLiquidityMinimum(uint256 _liquidityMinimum) external;
```

### **Reward Period Time**

```text
/// @notice Sets the time required to pass between rewards for jobs
/// @param _rewardPeriodTime The new amount of time required to pass between rewards
function setRewardPeriodTime(uint256 _rewardPeriodTime) external;
```

### **Inflation Period**

```text
/// @notice Sets the new inflation period
/// @param _inflationPeriod The new inflation period
function setInflationPeriod(uint256 _inflationPeriod) external;
```

### **Fee**

```text
/// @notice Sets the new fee
/// @param _fee The new fee
function setFee(uint256 _fee) external;
```

### **KP3R-WETH Pool Address**

```text
/// @notice Sets the KP3R-WETH pool address
/// @param _kp3rWethPool The KP3R-WETH pool address
function setkp3rWethPool(address _kp3rWethPool) external;
```

### **Keep3rV1Proxy Address**

```text
/// @notice Sets the Keep3rV1Proxy address
/// @param _keep3rV1Proxy The Keep3rV1Proxy address
function setKeep3rV1Proxy(address _keep3rV1Proxy) external;
```

### **Keep3rV1 Address**

```text
/// @notice Sets the Keep3rV1 address
/// @param _keep3rV1 The Keep3rV1 address
function setKeep3rV1(address _keep3rV1) external;
```

### **Keep3rHelper Address**

```text
/// @notice Sets the Keep3rHelper address
/// @param _keep3rHelper The Keep3rHelper address
function setKeep3rHelper(address _keep3rHelper) external;
```

## Manage Approved Liquidities

Governance is in charge of approving and removing what liquidity pairs are accepted in the network.

```text
/// @notice Approve a liquidity pair for being accepted in future
/// @param _liquidity The address of the liquidity accepted
function approveLiquidity(address _liquidity) external;
```

```text
/// @notice Revoke a liquidity pair from being accepted in future
/// @param _liquidity The liquidity no longer accepted
function revokeLiquidity(address _liquidity) external;
```

## Force Liquidity Credits

Governance can temporarily give liquidity credits to jobs. These liquidity credits will expire after the current [reward period](/tokenomics/job-payment-mechanisms/credit-mining.md#reward-periods) has ended.

```text
/// @notice Gifts liquidity credits to the specified job
/// @param _job The address of the job being credited
/// @param _amount The amount of liquidity credits to gift
function forceLiquidityCreditsToJob(address _job, uint256 _amount) external;
```





