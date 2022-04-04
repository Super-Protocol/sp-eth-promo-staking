// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PromoStaking {
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    uint256 constant STAKING_START_TIME = 1655251200; // ~ Jun 15 2022 00:00:00 GMT+0000
    uint256 constant STAKING_END_TIME = 1671062400; // ~ Dec 15 2022 00:00:00 GMT+0000
    uint256 constant ACCURACY = 1e12;

    mapping(address => UserInfo) public userInfo;

    bool public inited;
    uint256 public totalStaked;
    uint256 public cumulativeRewardPerShare;
    uint256 public lastUpdated = STAKING_START_TIME;

    // immutable
    uint256 public rewardPerSec;
    uint256 public totalReward;
    uint256 public totalRewardPaid;
    address public token;
    address public owner;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    modifier onlyOnInited() {
        require(inited, "Not inited");
        _;
    }

    modifier notFinished() {
        require(block.timestamp < STAKING_END_TIME, "Promo staking finished");
        _;
    }

    function _transferReward(address to, uint256 amount) private {
        require(totalRewardPaid + amount <= totalReward);
        IERC20(token).transfer(to, amount);
        totalRewardPaid += amount;
    }

    function getPendingTokens(address _user) external view returns (uint256 pending) {
        UserInfo storage user = userInfo[_user];
        pending = (user.amount * cumulativeRewardPerShare) / ACCURACY - user.rewardDebt;
    }

    function getStakedAmount(address _user) external view returns (uint256 amount) {
        amount = userInfo[_user].amount;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function initialize(
        address _token,
        uint256 _totalReward
    ) external {
        require(msg.sender == owner, "Only owner");
        require(!inited, "Already inited");
        token = _token;
        totalReward = _totalReward;
        rewardPerSec = totalReward / (STAKING_END_TIME - STAKING_START_TIME);
        inited = true;
    }

    function updCumulativeRewardPerShare() public onlyOnInited {
        if (block.timestamp <= lastUpdated) {
            return;
        }

        uint256 timePassed = block.timestamp - lastUpdated;
        if (totalStaked == 0) {
            lastUpdated = block.timestamp;
            return;
        }
        if (block.timestamp < STAKING_END_TIME) {
            cumulativeRewardPerShare += (timePassed * rewardPerSec * ACCURACY) / totalStaked;
            lastUpdated = block.timestamp;
        }
    }

    function stake(uint256 amount, address recipientAddress) external onlyOnInited notFinished {
        UserInfo storage recipient = userInfo[recipientAddress];
        address staker = msg.sender;
        updCumulativeRewardPerShare();

        uint256 pending = (recipient.amount * cumulativeRewardPerShare) / ACCURACY - recipient.rewardDebt;
        if (pending > 0) {
            _transferReward(recipientAddress, pending);
        }
        if (amount > 0) {
            IERC20(token).transferFrom(staker, address(this), amount);
            recipient.amount += amount;
            totalStaked += amount;
        }
        recipient.rewardDebt = (recipient.amount * cumulativeRewardPerShare) / ACCURACY;

        emit Deposit(recipientAddress, amount);
    }

    function unstake(uint256 amount) external onlyOnInited {
        UserInfo storage user = userInfo[msg.sender];
        updCumulativeRewardPerShare();

        require(user.amount >= amount, "Stake is not enough");
        uint256 pending = (user.amount * cumulativeRewardPerShare) / ACCURACY - user.rewardDebt;
        if (pending > 0) {
            _transferReward(msg.sender, pending);
        }
        if (amount > 0) {
            user.amount -= amount;
            totalStaked -= amount;
            IERC20(token).transfer(msg.sender, amount);
        }
        user.rewardDebt = (user.amount * cumulativeRewardPerShare) / ACCURACY;

        emit Withdraw(msg.sender, amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() external onlyOnInited {
        UserInfo storage user = userInfo[msg.sender];
        IERC20(token).transfer(address(msg.sender), user.amount);
        user.amount = 0;
        user.rewardDebt = 0;

        emit EmergencyWithdraw(msg.sender, user.amount);
    }
}
