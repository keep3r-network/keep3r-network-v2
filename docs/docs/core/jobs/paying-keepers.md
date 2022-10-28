---
sidebar_position: 3
---

# Paying Keepers
This is a crucial topic to understand when managing a job since there are currently two different ways to pay keepers with: `KP3R` or any `ERC20`.

:::info
The option you choose will dictate the way you have to add credits to the job.
:::

## Pay with KP3R
#### Automatic payment
If you want to avoid calculating payments by yourself, you can let the system calculate the recommended reward using the `worked()` function.
```js
function work() external {  
  myMainContract.doSomethingForMy();
  IKeep3r(keep3r).worked(_keeper); // calculates reward and pay the keeper.
}
```

#### Manual payment
With this option, you will have to do your own calculations for the reward amount.
```js
function work() external {
  myMainContract.doSomethingForMy();
  uint _payment = calculatePayment(); // calculate reward manually.
  IKeep3r(keep3r).bondedPayment(_keeper, _payment); // Pay keeper what you said.
}
```

## Pay with ERC20
#### Automatic payment
No automatic payment for ERC20 tokens.

#### Manual payment
With this option, you will have to do your own calculations for the reward amount.
```js
address rewardToken = 0xabc...; 

function work() external {
  myMainContract.doSomethingForMy();
  uint _payment = calculatePayment(); // calculate reward manually.
  IKeep3r(keep3r).directTokenPayment(rewardToken, _keeper, _payment); // Pay keeper what you said.
}
```