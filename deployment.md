# Keep3r V2 Mainnet Deployment

### Useful Addresses

- Keep3rV1: [0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44](https://etherscan.io/address/0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44)
- Keep3rV1Proxy: [0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d](https://etherscan.io/address/0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d)

### Steps

1. **Set Keep3rV1Proxy as Keep3rV1 governor**

   Keep3r multisig should call:

   1. `Keep3rV1.setGovernance(Keep3rV1Proxy)`
   2. `Keep3rV1Proxy.acceptKeep3rV1Governance()`

2. **Run Keep3rV2 deployment script**

   DeFi Wonderland team should run `yarn run deploy:mainnet`. This will:

   - deploy Keep3rV2Helper
   - deploy Keep3rV2
   - deploy UniswapV3PoolManagerFactory
   - create UniswapV3PoolManager WETH/KP3R

3. **Set Keep3rV2 as Keep3rV1Proxy minter**

   Keep3r multisig should call: `Keep3rV1Proxy.setMinter(Keep3rV2)`

4. **Approve created UniswapV3PoolManager as a valid liquidity in Keep3r V2**

   Keep3r multisig should call `Keep3rV2.approveLiquidity(UniswapV3PoolManager WETH/KP3R)`
