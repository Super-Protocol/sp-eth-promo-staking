import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumber } from 'ethers';
// eslint-disable-next-line camelcase
import { PromoStaking, SuperproToken } from '../typechain';

describe('PromoStaking', function () {
    let superproToken: SuperproToken;
    let promoStaking: PromoStaking;
    let deployer: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress;

    const STAKING_START_TIME = 1655251200;
    const STAKING_END_TIME = 1671062400;
    const TOTAL_REWARD = parseEther(10_000);
    const ACCURACY = 1e9;

    let snapshot: any;

    before(async function () {
        [deployer, alice, bob,] = await ethers.getSigners();
        // eslint-disable-next-line camelcase
        const SuperproTokenFactory = await ethers.getContractFactory('SuperproToken');
        superproToken = (await SuperproTokenFactory.deploy(parseEther(1000_000_000), 'SPT', 'Superpro Test Token')) as SuperproToken;
        await superproToken.deployed();
        // eslint-disable-next-line camelcase
        const PromoStaking = await ethers.getContractFactory('PromoStaking');

        promoStaking = (await PromoStaking.deploy(deployer.address)) as PromoStaking;
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

    async function setTimestamp(targetTime: number) {
        await network.provider.send('evm_setNextBlockTimestamp', [targetTime - 1]);
        await network.provider.send('evm_mine');
    }

    async function airdrop(userAddress: string, amount: BigNumber) {
        await superproToken.transfer(userAddress, amount);
    }

    async function initializeDefault() {
        await superproToken.transfer(promoStaking.address, TOTAL_REWARD);
        await promoStaking.connect(deployer).initialize(superproToken.address, TOTAL_REWARD);
    }

    it('Should initialize', async function () {
        await initializeDefault();

        expect(await promoStaking.token()).be.equal(superproToken.address);
        expect(await promoStaking.totalReward()).be.equal(TOTAL_REWARD);

        const tolerance = 10 ** -12;
        const stakingDurationTime = STAKING_END_TIME - STAKING_START_TIME;
        const calculatedReward = BigInt(+(await promoStaking.rewardPerSec()) * stakingDurationTime);
        const calculatedErrorSize = Number(BigInt(+TOTAL_REWARD) - calculatedReward);
        const avaliableErrorSize = Number(BigInt(+TOTAL_REWARD * tolerance));
        expect(calculatedErrorSize).be.lessThan(avaliableErrorSize);

        await expect(promoStaking.initialize(superproToken.address, 1)).be.revertedWith('Already inited');
    });

    it('Should stake own deposit', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);
    });

    it('Should stake deposit for another user', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);

        const bobStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, bobStaked);
        await superproToken.connect(alice).approve(promoStaking.address, bobStaked);

        await promoStaking.connect(alice).stake(bobStaked, bob.address);
        expect(await promoStaking.getStakedAmount(bob.address)).to.eq(bobStaked);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(0);
    });

    it('Should stake capitalization', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await promoStaking.connect(alice).unstake(0); // 1 sec skipped
        expect((await superproToken.balanceOf(alice.address)).div(ACCURACY)).to.eq((await promoStaking.rewardPerSec()).div(ACCURACY));
    });

    it('Should stake/unstake deposit + pending reward', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);
        const rewarsPerSec = await promoStaking.rewardPerSec();

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await promoStaking.connect(alice).unstake(aliceStaked); // + sec skipped
        expect((await superproToken.balanceOf(alice.address)).div(ACCURACY)).to.eq(aliceStaked.add(rewarsPerSec).div(ACCURACY));
    });

    it('Should receive own pending reward if you replenish your stake', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);
        const rewarsPerSec = await promoStaking.rewardPerSec();

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked.div(2), alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked.div(2));

        await promoStaking.connect(alice).stake(aliceStaked.div(2), alice.address); // + sec skipped
        expect((await superproToken.balanceOf(alice.address)).div(ACCURACY)).to.eq(rewarsPerSec.div(ACCURACY));
    });

    it('Should not receive pending reward if replenish stake for another user', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);

        const aliceStaked = parseEther(123); // 123 * 1e18
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
        await setTimestamp(STAKING_START_TIME);
        const rewarsPerSec = await promoStaking.rewardPerSec();

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await promoStaking.connect(alice).unstake(0);
        expect((await superproToken.balanceOf(alice.address)).div(ACCURACY)).to.eq(rewarsPerSec.div(ACCURACY));
    });

    it('Should accept stake before start date ', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME - 100);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await expect(promoStaking.connect(alice).stake(aliceStaked, alice.address)).to.be.not.reverted;
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);
    });

    it('Should not distribute rewards before start date', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME - 100);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await setTimestamp(STAKING_START_TIME);
        await promoStaking.connect(alice).updCumulativeRewardPerShare(); // skip 1 sec
        expect(await promoStaking.getPendingTokens(alice.address)).to.eq(0);

        await promoStaking.connect(alice).updCumulativeRewardPerShare(); // skip 1 sec
        const rewarsPerSec = await promoStaking.rewardPerSec();
        expect((await promoStaking.getPendingTokens(alice.address)).div(ACCURACY)).to.eq(rewarsPerSec.div(ACCURACY));
    });

    it('Should destribute rewards liner', async function () {
        await initializeDefault();

        await setTimestamp(STAKING_START_TIME);
        const rps1 = await promoStaking.rewardPerSec();
        await setTimestamp(STAKING_START_TIME + 100);
        const rps2 = await promoStaking.rewardPerSec();
        await setTimestamp(STAKING_START_TIME + 200);
        const rps3 = await promoStaking.rewardPerSec();

        expect(rps1).to.eq(rps2);
        expect(rps2).to.eq(rps3);
    });

    it('Should distribute rewards in proportion to staked tokens number and staked time', async function () {
        await initializeDefault();
        const fixedStakingInterval = 100; // blocks
        const rewarsPerPeriod = BigNumber.from(fixedStakingInterval).mul(await promoStaking.rewardPerSec());

        const aliceStaked = parseEther(10); // 10 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        const bobStaked = parseEther(20); // 20 * 1e18
        await airdrop(bob.address, bobStaked);
        await superproToken.connect(bob).approve(promoStaking.address, bobStaked);

        const totalStaked = bobStaked.add(aliceStaked);

        // alice stake for 2 <fixed interval> with 10 token
        // bob staked for 1 <fixed interval> with 20 token
        await setTimestamp(STAKING_START_TIME);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        await setTimestamp(STAKING_START_TIME + fixedStakingInterval);
        await promoStaking.connect(bob).stake(bobStaked, bob.address);
        await setTimestamp(STAKING_START_TIME + fixedStakingInterval * 2);
        await promoStaking.connect(bob).updCumulativeRewardPerShare();

        // check pending rewards (1)
        const alicePending = await promoStaking.getPendingTokens(alice.address);
        const bobPending = await promoStaking.getPendingTokens(bob.address);
        const aliceYield = Math.floor((1 + 1 / 3) * ACCURACY); // 1 periodReward + 1/3 periodReward
        const bobYield = Math.floor((2 / 3) * ACCURACY); // 2/3 periodReward

        expect(alicePending.mul(ACCURACY).div(rewarsPerPeriod)).to.equal(aliceYield);
        expect(bobPending.mul(ACCURACY).div(rewarsPerPeriod)).to.equal(bobYield);

        // unstake bob deposit and his reward
        await promoStaking.connect(bob).unstake(bobStaked);
        const bobRewardPerTic = (await promoStaking.rewardPerSec()).mul(bobStaked).div(totalStaked); // bcs skipped 1 sec after last calc
        expect((await superproToken.balanceOf(bob.address)).div(ACCURACY)).to.eq(bobStaked.add(bobPending).add(bobRewardPerTic).div(ACCURACY));

        // alice stake +1 <fixed interval>
        await setTimestamp(STAKING_START_TIME + fixedStakingInterval * 3);
        await promoStaking.connect(bob).updCumulativeRewardPerShare();

        // check pending rewards (2)
        const updBobPending = await promoStaking.getPendingTokens(bob.address);
        const updAlicePending = await promoStaking.getPendingTokens(alice.address);
        const updAliceYield = Math.floor((2 + 1 / 3) * ACCURACY) - Number(bobRewardPerTic.mul(ACCURACY).div(rewarsPerPeriod));
        const EPSILON = 1;

        expect(updBobPending).to.equal(0);
        expect(updAlicePending.mul(ACCURACY).div(rewarsPerPeriod)).to.equal(updAliceYield - EPSILON); // 2.326666666666
    });

    it('Should emergency withdraw', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);
        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await setTimestamp(STAKING_START_TIME + 100);
        await expect(promoStaking.connect(alice).emergencyWithdraw()).to.be.not.reverted;
        expect(await superproToken.balanceOf(alice.address)).to.eq(aliceStaked);
    });

    it('Should fail to stake after promo staking end', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_END_TIME + 1);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await expect(promoStaking.connect(alice).stake(aliceStaked, alice.address)).to.be.revertedWith('Promo staking finished');
    });

    it('Should fail to unstake more than staked', async function () {
        await initializeDefault();
        await setTimestamp(STAKING_START_TIME);

        const aliceStaked = parseEther(123); // 123 * 1e18
        await airdrop(alice.address, aliceStaked);
        await superproToken.connect(alice).approve(promoStaking.address, aliceStaked);

        await promoStaking.connect(alice).stake(aliceStaked, alice.address);
        expect(await promoStaking.getStakedAmount(alice.address)).to.eq(aliceStaked);

        await expect(promoStaking.connect(alice).unstake(aliceStaked.add(1))).to.be.revertedWith('Stake is not enough');
    });
});
