// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PromoStaking {
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    uint256 constant ACCURACY = 1e12;

    bool public initialized;
    uint256 public lastUpdated;
    uint256 public totalStaked;
    uint256 public totalRewardPaid;
    uint256 public cumulativeRewardPerShare;
    mapping(address => UserInfo) public userInfo;

    // immutable
    uint256 public rewardPerBlock;
    uint256 public totalReward;
    uint256 public startBlock;
    uint256 public endBlock;
    address public token;
    address public initializer;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(address _initializer) {
        initializer = _initializer;
    }

    function _transferReward(address to, uint256 amount) private {
        require(totalRewardPaid + amount <= totalReward);
        IERC20(token).transfer(to, amount);
        totalRewardPaid += amount;
    }

    function _getPendingReward(uint256 amount) private view returns(uint256) {
        return (amount * cumulativeRewardPerShare) / ACCURACY;
    }

    function getPendingTokens(address _user) external view returns (uint256 pending) {
        UserInfo storage user = userInfo[_user];
        pending = _getPendingReward(user.amount) - user.rewardDebt;
    }

    function getStakedAmount(address _user) external view returns (uint256 amount) {
        amount = userInfo[_user].amount;
    }

    function initialize(
        address _token,
        uint256 _totalReward,
        uint256 _startBlock,
        uint256 stakingDurationInBlocks
    ) external {
        require(msg.sender == initializer, "Only initializer");
        require(!initialized, "Already initialized");
        require(_startBlock > block.number, "Invalid start block");
        require(IERC20(_token).balanceOf(address(this)) >= _totalReward, "Token balance lower than desired");
        token = _token;
        totalReward = _totalReward;
        startBlock = _startBlock;
        lastUpdated = _startBlock;
        endBlock = _startBlock + stakingDurationInBlocks;
        rewardPerBlock = totalReward / stakingDurationInBlocks;
        initialized = true;
    }

    function updCumulativeRewardPerShare() public onlyIfInitialized {
        uint256 timePassed;
        if (block.number <= lastUpdated) {
            return;
        }
        if (totalStaked == 0) {
            lastUpdated = block.number;
            return;
        }
        if (block.number <= endBlock) {
            timePassed = block.number - lastUpdated;
            lastUpdated = block.number;
        } else {
            timePassed = endBlock - lastUpdated;
            lastUpdated = endBlock;
        }
        cumulativeRewardPerShare += (timePassed * rewardPerBlock * ACCURACY) / totalStaked;
    }

    function capitalizeStake() external onlyIfInitialized notFinished {
        require(startBlock < block.number, "Staking not started");
        address staker = msg.sender;
        UserInfo storage user = userInfo[staker];
        updCumulativeRewardPerShare();
        
        uint256 pending = _getPendingReward(user.amount) - user.rewardDebt;
        if (pending > 0) {
            user.amount += pending;
            totalStaked += pending;
            totalRewardPaid += pending;
            user.rewardDebt = _getPendingReward(user.amount);

            emit Deposit(staker, pending);
        }
    }

    function stake(uint256 amount, address recipientAddress) external onlyIfInitialized notFinished {
        UserInfo storage recipient = userInfo[recipientAddress];
        address staker = msg.sender;
        updCumulativeRewardPerShare();

        uint256 pending = _getPendingReward(recipient.amount) - recipient.rewardDebt;
        if (pending > 0) {
            _transferReward(recipientAddress, pending);
        }
        if (amount > 0) {
            IERC20(token).transferFrom(staker, address(this), amount);
            recipient.amount += amount;
            totalStaked += amount;
        }
        recipient.rewardDebt = _getPendingReward(recipient.amount);

        emit Deposit(recipientAddress, amount);
    }

    function unstake(uint256 amount) external onlyIfInitialized {
        UserInfo storage user = userInfo[msg.sender];
        updCumulativeRewardPerShare();

        require(user.amount >= amount, "Stake is not enough");
        uint256 pending = _getPendingReward(user.amount) - user.rewardDebt;
        if (pending > 0) {
            _transferReward(msg.sender, pending);
        }
        if (amount > 0) {
            user.amount -= amount;
            totalStaked -= amount;
            IERC20(token).transfer(msg.sender, amount);
        }
        user.rewardDebt = _getPendingReward(user.amount);

        emit Withdraw(msg.sender, amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() external onlyIfInitialized {
        updCumulativeRewardPerShare();
        UserInfo storage user = userInfo[msg.sender];

        IERC20(token).transfer(address(msg.sender), user.amount);
        totalStaked -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        emit EmergencyWithdraw(msg.sender, user.amount);
    }

    modifier onlyIfInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    modifier notFinished() {
        require(block.number < endBlock, "Promo staking finished");
        _;
    }
}
