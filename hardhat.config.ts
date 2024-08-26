import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import '@typechain/hardhat/dist/type-extensions';
import 'dotenv/config';
import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import { removeConsoleLog } from 'hardhat-preprocessor';
import { HardhatUserConfig } from 'hardhat/types';
import 'solidity-coverage';
import 'tsconfig-paths/register';
import { addressRegistry } from 'utils/constants';

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: process.env.TEST
    ? {
        hardhat: {
          hardfork: 'london',
          allowUnlimitedContractSize: true,
          companionNetworks: {
            mainnet: 'hardhat',
          },
        },
      }
    : {
        hardhat: {
          forking: {
            enabled: process.env.FORK ? true : false,
            url: process.env.MAINNET_HTTPS_URL as string,
          },
        },
        mainnet: {
          url: process.env.MAINNET_HTTPS_URL,
          accounts: [process.env.MAINNET_PRIVATE_KEY as string],
        },
        optimisticEthereum: {
          url: process.env.OPTIMISM_HTTPS_URL,
          accounts: [process.env.OPTIMISM_PRIVATE_KEY as string],
          companionNetworks: {
            mainnet: 'mainnet',
          },
        },
        polygon: {
          url: process.env.POLYGON_HTTPS_URL,
          accounts: [process.env.POLYGON_PRIVATE_KEY as string],
          companionNetworks: {
            mainnet: 'mainnet',
          },
        },
        sepolia: {
          url: process.env.SEPOLIA_HTTPS_URL,
          accounts: [process.env.SEPOLIA_PRIVATE_KEY as string],
        },
        optimisticSepolia: {
          url: process.env.OP_SEPOLIA_HTTPS_URL,
          accounts: [process.env.OP_SEPOLIA_PRIVATE_KEY as string],
        },
      },
  solidity: {
    compilers: [
      {
        version: '0.8.8',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY as string,
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY as string,
      polygon: process.env.POLYGON_ETHERSCAN_API_KEY as string,
      sepolia: process.env.SEPOLIA_ETHERSCAN_API_KEY as string,
      optimisticSepolia: process.env.OP_SEPOLIA_ETHERSCAN_API_KEY as string,
    },
    customChains: [
      {
        network: 'optimisticSepolia',
        chainId: 11155420,
        urls: {
          apiURL: 'https://api-sepolia-optimistic.etherscan.io/api',
          browserURL: 'https://sepolia-optimism.etherscan.io/',
        },
      },
    ],
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5',
  },
  namedAccounts: {
    deployer: 0,
    ...addressRegistry,
  },
  paths: {
    sources: './solidity',
  },
};

export default config;
