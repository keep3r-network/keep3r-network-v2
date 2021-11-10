import IUniV3PairManager from '@solidity/interfaces/IUniV3PairManager.sol/IUniV3PairManager.json';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ZERO_ADDRESS } from '../../test/utils/constants';
import { shouldVerifyFactoryContract } from '../../utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  // pool to use as a KP3R/WETH liquidity
  const uniV3PoolAddress = '0x11b7a6bc0259ed6cf9db8f499988f9ecc7167bf5';

  var pairManagerAddress = await hre.deployments.read('UniV3PairManagerFactory', 'pairManagers', uniV3PoolAddress);

  if (pairManagerAddress == ZERO_ADDRESS) {
    const deployTx = await hre.deployments.execute(
      'UniV3PairManagerFactory',
      { from: deployer, gasLimit: 5000000, log: true },
      'createPairManager',
      uniV3PoolAddress
    );

    pairManagerAddress = await hre.deployments.read('UniV3PairManagerFactory', 'pairManagers', uniV3PoolAddress);

    if (await shouldVerifyFactoryContract(deployTx)) {
      await hre.run('verify:verify', {
        contract: 'solidity/contracts/UniV3PairManager.sol:UniV3PairManager',
        address: pairManagerAddress,
        constructorArguments: [uniV3PoolAddress, deployer],
      });
    }
  }

  hre.deployments.save('UniV3PairManager', {
    address: pairManagerAddress,
    abi: IUniV3PairManager.abi,
  });
};

deployFunction.tags = ['UniV3PairManager', 'KP3RWETHPair', 'mainnet'];

export default deployFunction;
