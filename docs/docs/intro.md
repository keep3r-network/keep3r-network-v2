---
sidebar_position: 1
---
# Introduction

_These docs are in active development by the Keep3r community._

The Keep3r Network allows delegating the execution of contracts to external actors (keepers), who in return will get the gas refunded and an added reward. Protocols will add their jobs (smart contracts) to the network, and keepers will execute the jobs for them.
Everything in the Keep3r Network is permissionless, allowing anyone to create a job, or become a keeper.


## [Jobs](core/jobs/README.md)

A Job is a term used to refer to a smart contract that wishes for an external entity (keeper) to execute an action. The job will wrap a particular function with extra logic in order to add the mechanism to reward keepers. Jobs would like the action to be performed in "goodwill" and not have a malicious result

## [Keepers](core/keepers/README.md)
A Keeper is the term used to refer to an external address that executes a job. 


## [Credits](tokenomics/job-payment-mechanisms/)

Credits are allocated to each job and used to pay keepers for their work. A job can top up credits by [depositing tokens](tokenomics/job-payment-mechanisms/token-payments.md) or mining credits through [staking on liquidity pools](tokenomics/job-payment-mechanisms/credit-mining.md).

