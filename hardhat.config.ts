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

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: process.env.TEST
    ? {
        hardhat: {
          allowUnlimitedContractSize: true,
          initialBaseFeePerGas: 1,
        },
      }
    : {
        hardhat: {
          forking: {
            enabled: process.env.FORK ? true : false,
            url: process.env.MAINNET_HTTPS_URL as string,
          },
        },
        localMainnet: {
          url: process.env.LOCAL_MAINNET_HTTPS_URL,
          accounts: [process.env.LOCAL_MAINNET_PRIVATE_KEY as string],
        },
        mainnet: {
          url: process.env.MAINNET_HTTPS_URL,
          accounts: [process.env.MAINNET_PRIVATE_KEY as string],
          gasPrice: 'auto',
        },
        ropsten: {
          url: process.env.ROPSTEN_HTTPS_URL,
          accounts: [process.env.ROPSTEN_PRIVATE_KEY as string],
        },
      },
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.12',
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
      {
        version: '0.4.18',
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
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5',
  },
  namedAccounts: {
    deployer: 0,
    governor: 1,
    feeRecipient: 2,
  },
  paths: {
    sources: './solidity',
  },
};

export default config;
