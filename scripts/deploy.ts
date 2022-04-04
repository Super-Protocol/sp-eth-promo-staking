import { ethers } from 'hardhat';

async function main() {
    if (!process.env.ADMIN_MULTISIG) {
        throw new Error('ADMIN_MULTISIG is not provided');
    }

    const PromoStaking = await ethers.getContractFactory('PromoStaking');
    const promoStaking = await PromoStaking.deploy(process.env.ADMIN_MULTISIG);
    await promoStaking.deployed();

    console.log('PromoStaking deployed to:', promoStaking.address);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
