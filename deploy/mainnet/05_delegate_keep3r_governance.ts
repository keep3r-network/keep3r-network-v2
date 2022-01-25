import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  // Keep3r Governance Multisig address
  const keep3rMultisig = '0x0D5Dc686d0a2ABBfDaFDFb4D0533E886517d4E83';

  await hre.deployments.execute('Keep3r', { from: deployer, gasLimit: 100000, log: true }, 'setGovernance', keep3rMultisig);
};

deployFunction.tags = ['delegate-keep3r', 'Governance', 'mainnet'];

export default deployFunction;
