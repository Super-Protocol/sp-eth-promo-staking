import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumber } from 'ethers';
import { PromoStaking, SuperproToken } from '../typechain';

describe('PromoStaking', function () {
    let superproToken: SuperproToken;
    let promoStaking: PromoStaking;
    let deployer: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress;

    const STAKING_START_BLOCK = 10;
    const STAKING_DURATION_IN_BLOCKS = 300;
    const TOTAL_REWARD = parseEther(10_000);
    const ACCURACY = 10 ** 9;

    let snapshot: any;

    before(async function () {
        [deployer, alice, bob] = await ethers.getSigners();
        const SuperproTokenFactory = await ethers.getContractFactory('SuperproToken');
        superproToken = (await SuperproTokenFactory.deploy(parseEther(1000_000_000), 'SPT', 'Superpro Test Token')) as SuperproToken;
        await superproToken.deployed();
        const PromoStakingFactory = await ethers.getContractFactory('PromoStaking');

        promoStaking = (await PromoStakingFactory.deploy(deployer.address)) as PromoStaking;
        await promoStaking.deployed();
        snapshot = await network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });
    });

    afterEach(async function () {
        await network.provider.request({
            method: 'evm_revert',
            params: [snapshot],
        });

        snapshot = await network.provider.request({
            method: 'evm_snapshot',
            params: [],
        });
    });

    function parseEther(amount: number) {
        return ethers.utils.parseEther(amount.toString());
    }

    async function setBlockNumber(blocksIndex: number) {
        const blockNumber = await network.provider.send('eth_blockNumber');
        const delta = blocksIndex - blockNumber;
        if (delta < 0) throw Error('Invalid block index');
        for (let index = 0; index < delta; index++) {
            await network.provider.send('evm_mine');
        }
    }

    async function airdrop(userAddress: string, amount: BigNumber) {
        await superproToken.transfer(userAddress, amount);
    }

    async function initializeDefault() {
        await superproToken.transfer(promoStaking.address, TOTAL_REWARD);
        await promoStaking.connect(deployer).initialize(
            superproToken.address,
            STAKING_START_BLOCK,
            STAKING_DURATION_IN_BLOCKS,
        );
    }

    it('Should initialize', async function () {
        await expect(initializeDefault()).to.not.be.reverted;

        expect(await promoStaking.token()).be.equal(superproToken.address);
        expect(await promoStaking.totalReward()).be.equal(TOTAL_REWARD);

        const tolerance = 10 ** 12;
        const calculatedReward = (await promoStaking.rewardPerBlock()).mul(STAKING_DURATION_IN_BLOCKS);
        const calculatedErrorSize = TOTAL_REWARD.sub(calculatedReward);
        const avaliableErrorSize = TOTAL_REWARD.div(tolerance);
        expect(+calculatedErrorSize).be.lessThan(+avaliableErrorSize);
    });

    it('Should initialized only one time', async function () {
        await initializeDefault();
        await expect(promoStaking.initialize(superproToken.address, STAKING_START_BLOCK, STAKING_DURATION_IN_BLOCKS)).be.revertedWith('Already initialized');
    });

    it('Should fail initialize with a startBlock less than the current block', async function () {
        await superproToken.transfer(promoStaking.address, TOTAL_REWARD);
        const currentBlockNumber = await network.provider.send('eth_blockNumber');
        await expect(promoStaking.connect(deployer).initialize(
            superproToken.address,
            currentBlockNumber - 1,
            STAKING_DURATION_IN_BLOCKS,
        )).to.be.revertedWith('Invalid start block');
    });

    it('Should stake own deposit', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);
    });

    it('Should stake deposit for another user', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);

        const bobStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, bobStaked);
        await superproToken.connect(alice).approve(promoStaking.address, bobStaked);

        await promoStaking.connect(alice).stake(bobStaked, bob.address);
        expect(await promoStaking.getStakedAmount(bob.address)).to.eq(bobStaked);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(0);
    });

    it('Should stake/unstake deposit + pending reward', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);
        const rewarsPerBlock = await promoStaking.rewardPerBlock();

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await promoStaking.connect(alice).unstake(aliceStaked); // after method call, blockchain timestamp increase +1 sec
        expect((await superproToken.balanceOf(alice.address)).div(ACCURACY)).to.eq(aliceStaked.add(rewarsPerBlock).div(ACCURACY));
    });

    it('Should not receive pending reward if replenish stake for another user', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked.div(2), alice.address); // own stake
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked.div(2));

        await promoStaking.connect(alice).stake(aliceStaked.div(2), bob.address); // stake for other user
        expect(await promoStaking.getStakedAmount(bob.address)).to.eq(aliceStaked.div(2));

        expect(await superproToken.balanceOf(bob.address)).to.eq(0);
        expect(await superproToken.balanceOf(alice.address)).to.eq(0);
    });

    it('Should claim only profit', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);
        const rewarsPerBlock = await promoStaking.rewardPerBlock();

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await promoStaking.connect(alice).unstake(0);
        expect((await superproToken.balanceOf(alice.address)).div(ACCURACY)).to.eq(rewarsPerBlock.div(ACCURACY));
    });

    it('Should accept stake before start date', async function () {
        await initializeDefault();
        const blockNumberBeforeStakingStart = STAKING_START_BLOCK - 5;
        await setBlockNumber(blockNumberBeforeStakingStart);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await expect(promoStaking.connect(alice).stake(aliceStaked, alice.address)).to.be.not.reverted;
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);
    });

    it('Should not distribute rewards before start date', async function () {
        await initializeDefault();
        const blockNumberBeforeStakingStart = STAKING_START_BLOCK - 5;
        await setBlockNumber(blockNumberBeforeStakingStart);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await setBlockNumber(STAKING_START_BLOCK);
        const rewarsPerBlock = await promoStaking.rewardPerBlock();
        await promoStaking.connect(alice).updCumulativeRewardPerShare(); // skip 1 sec
        const pendingTokens = await promoStaking.getPendingTokens(alice.address);
        expect(pendingTokens.div(ACCURACY)).to.eq(rewarsPerBlock.div(ACCURACY));
    });

    it('Should distribute rewards less or equal total reward', async function () {
        await initializeDefault();

        const aliceStaked = parseEther(10); // 10 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        // stake before staking start
        await setBlockNumber(STAKING_START_BLOCK - 2);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        // anstake after staking finished
        await setBlockNumber(STAKING_START_BLOCK + STAKING_DURATION_IN_BLOCKS + 2);
        await promoStaking.connect(alice).unstake(aliceStaked);

        const totalRewardPaid = +(await promoStaking.totalRewardPaid());
        const totalReward = +(await promoStaking.totalReward());
        expect(totalRewardPaid).lessThanOrEqual(totalReward);
    });

    it('Should destribute rewards liner', async function () {
        await initializeDefault();

        await setBlockNumber(STAKING_START_BLOCK);
        const rps1 = await promoStaking.rewardPerBlock();
        await setBlockNumber(STAKING_START_BLOCK + 100);
        const rps2 = await promoStaking.rewardPerBlock();
        await setBlockNumber(STAKING_START_BLOCK + 200);
        const rps3 = await promoStaking.rewardPerBlock();

        expect(rps1).to.eq(rps2);
        expect(rps2).to.eq(rps3);
    });

    it('Should distribute rewards in proportion to staked tokens number and staked time. Part #1', async function () {
        await initializeDefault();
        const fixedStakingInterval = 100; // blocks
        const rewarsPerPeriod = BigNumber.from(fixedStakingInterval).mul(await promoStaking.rewardPerBlock());

        const aliceStaked = parseEther(10); // 10 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        const bobStaked = parseEther(20); // 20 * 10^18
        await airdrop(bob.address, bobStaked);
        await superproToken.connect(bob).approve(promoStaking.address, bobStaked);

        // Alice stake for 2 <fixed interval> with 10 token
        await setBlockNumber(STAKING_START_BLOCK);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        await setBlockNumber(STAKING_START_BLOCK + fixedStakingInterval);
        // Bob staked for 1 <fixed interval> with 20 token (1 <fixed interval> after Alice has staked)
        await promoStaking.connect(bob).stake(bobStaked, bob.address);
        await setBlockNumber(STAKING_START_BLOCK + fixedStakingInterval * 2);

        // check pending rewards
        await promoStaking.connect(deployer).updCumulativeRewardPerShare();
        const alicePending = await promoStaking.getPendingTokens(alice.address);
        const bobPending = await promoStaking.getPendingTokens(bob.address);
        const aliceYield = Math.floor((1 + 1 / 3) * ACCURACY); // 1 periodReward + 1/3 periodReward
        const bobYield = Math.floor((2 / 3) * ACCURACY); // 2/3 periodReward

        expect(alicePending.mul(ACCURACY).div(rewarsPerPeriod)).to.equal(aliceYield);
        expect(bobPending.mul(ACCURACY).div(rewarsPerPeriod)).to.equal(bobYield);
    });

    it('Should distribute rewards in proportion to staked tokens number and staked time. Part #2', async function () {
        await initializeDefault();
        const fixedStakingInterval = 100; // blocks
        const rewarsPerPeriod = BigNumber.from(fixedStakingInterval).mul(await promoStaking.rewardPerBlock());

        const aliceStaked = parseEther(10); // 10 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        const bobStaked = parseEther(20); // 20 * 10^18
        await airdrop(bob.address, bobStaked);
        await superproToken.connect(bob).approve(promoStaking.address, bobStaked);

        // Alice stake for 2 <fixed interval> with 10 token (First interval with Bob, second standalone)
        // Bob staked for 1 <fixed interval> with 20 token
        await setBlockNumber(STAKING_START_BLOCK);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address); // from STAKING_START_BLOCK
        await promoStaking.connect(bob).stake(bobStaked, bob.address); // from STAKING_START_BLOCK + 1
        await setBlockNumber(STAKING_START_BLOCK + fixedStakingInterval + 1);
        await promoStaking.connect(bob).unstake(bobStaked);
        await setBlockNumber(STAKING_START_BLOCK + fixedStakingInterval * 2);

        // check pending rewards
        await promoStaking.connect(deployer).updCumulativeRewardPerShare();
        const alicePending = await promoStaking.getPendingTokens(alice.address);
        const bobBalance = await superproToken.balanceOf(bob.address);
        const aliceYield = Math.floor((1 + 1 / 3) * ACCURACY); // 1 periodReward + 1/3 periodReward
        const bobYield = Math.floor((2 / 3) * ACCURACY); // 2/3 periodReward

        expect(alicePending.mul(ACCURACY).div(rewarsPerPeriod)).to.equal(aliceYield);
        expect((bobBalance.sub(bobStaked)).mul(ACCURACY).div(rewarsPerPeriod)).to.equal(bobYield);
    });

    it('Should emergency withdraw', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await setBlockNumber(STAKING_START_BLOCK + 100);
        await expect(promoStaking.connect(alice).emergencyWithdraw()).to.be.not.reverted;
        expect(await superproToken.balanceOf(alice.address)).to.eq(aliceStaked);
    });

    it('Should fail to stake after promo staking end', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK + STAKING_DURATION_IN_BLOCKS + 1);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await expect(promoStaking.connect(alice).stake(aliceStaked, alice.address)).to.be.revertedWith('Promo staking finished');
    });

    it('Should fail to unstake more than staked', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await expect(promoStaking.connect(alice).unstake(aliceStaked.add(1))).to.be.revertedWith('Stake is not enough');
    });

    it('Should capitalize pending tokens', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK);

        const aliceStaked = parseEther(123); // 123 * 10^18
        const rewarsPerBlock = await promoStaking.rewardPerBlock();
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address);

        await setBlockNumber(STAKING_START_BLOCK + 12); // skip 10 block after stake (+approve, +capitalizeStake)
        await promoStaking.connect(alice).stake(0, alice.address);

        expect(await promoStaking.getPendingTokens(alice.address)).to.eq(0);
        expect(
            (await promoStaking.getStakedAmount(alice.address)).mul(ACCURACY).div(aliceStaked)
        ).to.eq(
            aliceStaked.add(rewarsPerBlock.mul(10)).mul(ACCURACY).div(aliceStaked)
        );
    });

    it('Should fail capitalize pending tokens after staking finished', async function () {
        await initializeDefault();
        await setBlockNumber(STAKING_START_BLOCK + STAKING_DURATION_IN_BLOCKS - 4);

        const aliceStaked = parseEther(123); // 123 * 10^18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await expect(promoStaking.connect(alice).stake(0, alice.address)).to.be.revertedWith('Promo staking finished');
    });
});
