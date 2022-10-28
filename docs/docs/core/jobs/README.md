---
sidebar_position: 1
---
# Introduction

From a high-level perspective, a job is a contract that wraps a particular function from another contract to add a reward mechanism to incentivize external actors to execute it.
Colloquially speaking, creating a job is like telling the keepers: “Here’s a function that you have to call every “X” amount of time. If you call it and execute it successfully, we will pay you.” That function tends to be called `work`.  
A properly set up job will have the following functions (names can vary, but the ones described below are the standard):  
- `work()`: This is the main function of a job. It’s the function that keepers call to “work the job”.  
- `workable()`: Returns a boolean indicating whether the job can be worked or not. This is a way to check beforehand if a job is ready to work.  
Once your job contract is added to the Keep3r Network you will be able to manage credits and payments through the [Keep3r V2 contract methods](https://etherscan.io/address/0xeb02addCfD8B773A5FFA6B9d1FE99c566f8c44CC#writeContract#F6).
