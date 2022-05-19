import { task } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';

task('initialize', 'deploy and initialize PromoStaking')
    .addParam('initializer', 'initializer address')
    .addParam('start', 'start block')
    .addParam('duration', 'staking duration in blocks')
    .setAction(async ({ initializer, start, duration }, { ethers }) => {
        const PromoStakingFactory = await ethers.getContractFactory('PromoStaking');
        const promoStaking = await PromoStakingFactory.deploy(initializer);
        await promoStaking.deployed();

        console.log('PromoStaking deployed to:', promoStaking.address);

        const SuperproTokenFactory = await ethers.getContractFactory('SuperproToken');
        const superproToken = await SuperproTokenFactory.deploy(100000, 'TEE', 'Superpro Token');
        await superproToken.deployed();

        console.log('SuperproToken deployed to:', superproToken.address);

        const txn = await promoStaking.initialize(superproToken.address, start, duration);
        await txn.wait();

        console.log('Done');
    });
