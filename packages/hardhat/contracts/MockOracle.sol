// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockOracle is Ownable {
    uint256 private premiumRate;

    function setPremiumRate(uint256 _premiumRate) external onlyOwner {
        premiumRate = _premiumRate;
    }

    function getPremiumRate() external view returns (uint256) {
        return premiumRate;
    }
}
