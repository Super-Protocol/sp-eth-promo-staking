// import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'solidity-coverage';
import { task } from 'hardhat/config';
import { config } from './config';
import { utils } from 'ethers';

// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

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
            account: config.localhostDeployerPrivateKey,
        },
        mumbai: {
            // https://docs.matic.network/docs/develop/network-details/network/
            chainId: 80001,
            url: 'https://matic-mumbai.chainstacklabs.com',
            accounts: [config.mumbaiDeployerPrivateKey],
        },
        mainnet: {
            url: '',
        },
        ethereum: {
            url: 'https://main-light.eth.linkpool.io',
            accounts: [config.ethereumDeployerPrivateKey],
        },
        polygon: {
            url: 'https://polygon-rpc.com',
            accounts: [config.polygonDeployerPrivateKey],
        },
    },
    etherscan: {
        apiKey: {
            polygon: config.polygonApiKey,
            mainnet: config.ethereumApiKey,
        },
    },
};
