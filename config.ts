import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '/.env') });

export const config = {
    mumbaiDeployerPrivateKey: process.env.MUMBAI_DEPLOYER_PRIVATE_KEY,
    localhostDeployerPrivateKey: process.env.LOCALHOST_DEPLOYER_PRIVATE_KEY,
    ethereumDeployerPrivateKey: process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY,
    polygonDeployerPrivateKey: process.env.POLYGON_DEPLOYER_PRIVATE_KEY,
    polygonApiKey: process.env.POLYGON_API_KEY,
    ethereumApiKey: process.env.ETHEREUM_API_KEY,
};
