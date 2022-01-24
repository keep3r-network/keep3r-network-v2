import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // KP3R/WETH 1% Uniswap V3 Pool
  const uniV3PoolAddress = '0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5';
  const pairManagerAddress = '0xFBBa1784163212E7b639Ed9E434E3aED48036b34';
  const governance = '0x0d5dc686d0a2abbfdafdfb4d0533e886517d4e83';

  await hre.run('verify:verify', {
    contract: 'solidity/contracts/UniV3PairManager.sol:UniV3PairManager',
    address: pairManagerAddress,
    constructorArguments: [uniV3PoolAddress, governance],
  });
};

deployFunction.tags = ['verify', 'pair-manager', 'mainnet'];

export default deployFunction;
