// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./openzeppelin/contracts/utils/math/SafeCast.sol";

contract PromoStaking {
    using SafeCast for uint256;

    struct UserInfo {
        uint128 amount;
        uint128 rewardDebt;
    }

    uint64 constant ACCURACY = 1e12;

    bool public initialized;
    uint32 public lastUpdated;
    uint128 public totalStaked;
    uint128 public totalRewardPaid;
    uint128 public cumulativeRewardPerShare;
    mapping(address => UserInfo) public userInfo;

    // immutable
    uint128 public rewardPerBlock;
    uint128 public totalReward;
    uint32 public startBlock;
    uint32 public endBlock;
    address public token;
    address public initializer;

    event Deposit(address indexed user, uint128 amount);
    event Withdraw(address indexed user, uint128 amount);
    event EmergencyWithdraw(address indexed user, uint128 amount);

    constructor(address _initializer) {
        initializer = _initializer;
    }

    function _transferReward(address to, uint128 amount) private {
        require(totalRewardPaid + amount <= totalReward);
        IERC20(token).transfer(to, amount);
        totalRewardPaid += amount;
    }

    function _getPendingReward(uint256 amount) private view returns(uint128) {
        return uint128((amount * cumulativeRewardPerShare) / ACCURACY);
    }

    function getPendingTokens(address _user) public view returns (uint128 pending) {
        UserInfo storage user = userInfo[_user];
        pending = _getPendingReward(user.amount) - user.rewardDebt;
    }

    function getStakedAmount(address _user) external view returns (uint256 amount) {
        amount = userInfo[_user].amount;
    }

    function initialize(
        address _token,
        uint32 _startBlock,
        uint32 stakingDurationInBlocks
    ) external {
        require(msg.sender == initializer, "Only initializer");
        require(!initialized, "Already initialized");
        require(_startBlock > block.number, "Invalid start block");
        token = _token;
        totalReward = IERC20(_token).balanceOf(address(this)).toUint128();
        startBlock = _startBlock;
        lastUpdated = _startBlock;
        endBlock = _startBlock + stakingDurationInBlocks;
        rewardPerBlock = totalReward * ACCURACY / stakingDurationInBlocks;
        initialized = true;
    }

    function updCumulativeRewardPerShare() public onlyIfInitialized {
        uint32 timePassed;
        uint32 blockNumber = block.number.toUint32();
        if (blockNumber <= lastUpdated) {
            return;
        }
        if (totalStaked == 0) {
            lastUpdated = blockNumber;
            return;
        }
        if (blockNumber <= endBlock) {
            timePassed = blockNumber - lastUpdated;
            lastUpdated = blockNumber;
        } else {
            timePassed = endBlock - lastUpdated;
            lastUpdated = endBlock;
        }
        cumulativeRewardPerShare += (timePassed * rewardPerBlock) / totalStaked;
    }

    function stake(uint128 amount, address recipientAddress) external onlyIfInitialized notFinished {
        UserInfo storage recipient = userInfo[recipientAddress];
        address staker = msg.sender;

        updCumulativeRewardPerShare();
        uint128 pending = getPendingTokens(recipientAddress);
        if (pending > 0) {
            recipient.amount += pending;
            totalStaked += pending;
            totalRewardPaid += pending;
        }
        if (amount > 0) {
            IERC20(token).transferFrom(staker, address(this), amount);
            recipient.amount += amount;
            totalStaked += amount;
        }
        recipient.rewardDebt = _getPendingReward(recipient.amount);

        emit Deposit(recipientAddress, amount + pending);
    }

    function unstake(uint128 amount) external onlyIfInitialized {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= amount, "Stake is not enough");

        updCumulativeRewardPerShare();
        uint128 pending = getPendingTokens(msg.sender);
        if (pending > 0) {
            _transferReward(msg.sender, pending);
        }
        if (amount > 0) {
            user.amount -= amount;
            totalStaked -= amount;
            IERC20(token).transfer(msg.sender, amount);
        }
        user.rewardDebt = _getPendingReward(user.amount);

        emit Withdraw(msg.sender, amount + pending);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() external onlyIfInitialized {
        updCumulativeRewardPerShare();
        UserInfo storage user = userInfo[msg.sender];

        IERC20(token).transfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, user.amount);

        totalStaked -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
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
