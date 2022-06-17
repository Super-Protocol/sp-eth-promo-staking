import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '/.env') });

export const config = {
    mainnetUrl: process.env.MAINNET_URL,
    mumbaiUrl: process.env.MUMBAI_URL,
    testPrivateKey: process.env.TEST_PRIVATE_KEY,
    deployerPrivateKey: process.env.PRIVATE_KEY,
    polygonApiKey: process.env.POLYGONSCAN_API_KEY,
    ethereumApiKey: process.env.ETHERSCAN_API_KEY,
};
