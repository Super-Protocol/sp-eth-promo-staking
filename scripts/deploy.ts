import { ethers } from 'hardhat';

async function main() {
    if (!process.env.INITIALIZER) {
        throw new Error('INITIALIZER is not provided');
    }

    const PromoStakingFactory = await ethers.getContractFactory('PromoStaking');
    const promoStaking = await PromoStakingFactory.deploy(process.env.INITIALIZER);
    await promoStaking.deployed();

    console.log('PromoStaking deployed to:', promoStaking.address);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
