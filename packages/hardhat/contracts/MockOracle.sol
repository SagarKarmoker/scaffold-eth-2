// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockOracle {
    uint256 private premiumRate;

    function setPremiumRate(uint256 _rate) external {
        premiumRate = _rate;
    }

    function getPremiumRate() external view returns (uint256) {
        return premiumRate;
    }
}
