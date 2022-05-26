import { task } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import { parseEther } from 'ethers/lib/utils';

task('initialize', 'deploy and initialize PromoStaking')
    .addParam('start', 'start block')
    .addParam('duration', 'staking duration in blocks')
    .setAction(async ({ start, duration }, { ethers }) => {
        const [initializer] = await ethers.getSigners();
    
        const PromoStakingFactory = await ethers.getContractFactory('PromoStaking');
        const promoStaking = await PromoStakingFactory.deploy(initializer.address);
        await promoStaking.deployed();

        console.log('PromoStaking deployed to:', promoStaking.address);

        const SuperproTokenFactory = await ethers.getContractFactory('SuperproToken');
        const superproToken = await SuperproTokenFactory.deploy(parseEther('1000000000'), 'TEE', 'Superpro Token');
        await superproToken.deployed();

        console.log('SuperproToken deployed to:', superproToken.address);

        let txn = await superproToken.transfer(promoStaking.address, parseEther('10000000'));
        await txn.wait();

        txn = await promoStaking.initialize(superproToken.address, start, duration);
        await txn.wait();

        console.log('Done');
    });
