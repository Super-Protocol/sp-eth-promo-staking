// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract SuperproToken is ERC20, ERC20Burnable {
    constructor(
        uint256 supply,
        string memory ticker,
        string memory description
    ) ERC20(description, ticker) {
        _mint(msg.sender, supply);
    }
}
