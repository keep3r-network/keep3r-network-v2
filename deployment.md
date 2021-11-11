# Keep3r V2 Mainnet Deployment

### Useful Addresses

- Keep3rV1: [0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44](https://etherscan.io/address/0x1ceb5cb57c4d4e2b2433641b95dd330a33185a44)
- Keep3rV1Proxy: [0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d](https://etherscan.io/address/0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d)
- UniswapV3Pool WETH/KP3R 1%: [0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5](https://etherscan.io/address/0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5)

### Steps

1. **Run Keep3rV2 deployment script**

   DeFi Wonderland team should run `yarn run deploy:mainnet`. This will:

   - deploy Keep3rV2Helper
   - deploy Keep3rV2
   - deploy UniswapV3PairManagerFactory

2. **Accept Keep3r V2 governance**

   Keep3r multisig should call:

   1. `Keep3rV2.acceptGovernance()`

3. **Set Keep3rV1Proxy as Keep3rV1 governor**

   Keep3r multisig should call:

   1. `Keep3rV1.setGovernance(Keep3rV1Proxy)`
   2. `Keep3rV1Proxy.acceptKeep3rV1Governance()`

4. **Set Keep3rV2 as Keep3rV1Proxy minter**

   Keep3r multisig should call: `Keep3rV1Proxy.setMinter(Keep3rV2)`

5. **Create UniswapV3PairManager using the UniswapV3PairManagerFactory**

   Keep3r multisig should call:

   1. `UniswapV3PairManagerFactory.acceptGovernance()`
   2. `UniswapV3PairManagerFactory.createPairManager(UniswapV3PoolAddress)`

6. **Approve UniswapV3PairManager WETH/KP3R liquidity**

   Keep3r multisig should call: `Keep3rV2.approveLiquidity(UniswapV3PairManagerWETHKP3R)`
