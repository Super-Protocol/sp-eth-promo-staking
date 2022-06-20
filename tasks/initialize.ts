import { task } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';

task('initialize', 'initialize PromoStaking')
    .addParam('contract', 'deployed PromoStaking address')
    .addParam('token', 'deployed token address')
    .addParam('start', 'start block')
    .addParam('duration', 'staking duration in blocks')
    .setAction(async (taskArgs, { ethers }) => {
        const [initializer] = await ethers.getSigners();
        const promoStaking = await ethers.getContractAt('PromoStaking', taskArgs.contract);

        const txn = await promoStaking.connect(initializer).initialize(taskArgs.token, taskArgs.start, taskArgs.duration);
        await txn.wait();

        console.log('Done');
    });
