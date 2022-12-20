import { Deployment, DeployResult } from 'hardhat-deploy/dist/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export const verifyContract = async (hre: HardhatRuntimeEnvironment, deploy: DeployResult | Deployment): Promise<void> => {
  if (hre.network.config.chainId === 31337 || !hre.config.etherscan.apiKey) {
    return; // contract is deployed on local network or no apiKey is configured
  }
  try {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: deploy.args,
    });
  } catch (err: any) {
    if (err.message.includes('Reason: Already Verified')) {
      console.log('Contract is already verified!');
    }
  }
};

export const verifyContractByAddress = async (hre: HardhatRuntimeEnvironment, address: string, args?: any[]): Promise<void> => {
  const deploy = {
    address,
    args,
  } as DeployResult;
  await verifyContract(hre, deploy);
};
