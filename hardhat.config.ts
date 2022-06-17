import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-gas-reporter';
import { config } from './config';
import { utils } from 'ethers';
import './tasks/initialize';

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
    solidity: {
        compilers: [
            {
                version: '0.8.9',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000,
                    },
                },
            },
        ],
    },
    contractSizer: {
        alphaSort: false,
        disambiguatePaths: true,
        runOnCompile: true,
        strict: false,
    },
    mocha: {
        timeout: 0,
        bail: true,
    },
    networks: {
        hardhat: {
            chainId: 1337,
            mining: {
                auto: true,
            },
            gasPrice: 1,
            initialBaseFeePerGas: 1,
            accounts: {
                accountsBalance: utils.parseEther('100000000').toString(),
                count: 10,
            },
        },
        local: {
            url: 'http://localhost:8545',
            account: config.testPrivateKey,
        },
        mumbai: {
            chainId: 80001,
            url: config.mumbaiUrl,
            accounts: [config.testPrivateKey],
        },
        polygon: {
            url: config.mumbaiUrl,
            accounts: [config.testPrivateKey],
        },
        ethereum: {
            url: config.mainnetUrl,
            accounts: [config.deployerPrivateKey],
        },
    },
    etherscan: {
        apiKey: {
            mainnet: config.ethereumApiKey,
            polygon: config.polygonApiKey,
            polygonMumbai: config.polygonApiKey,
        },
    },
};
