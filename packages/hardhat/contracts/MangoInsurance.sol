// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOracle {
    function getPremiumRate() external view returns (uint256);
}

contract MangoInsurance {
    enum Role { Farmer, Insurer, Auditor }
    enum ClaimStatus { Pending, Approved, Rejected }

    struct Policy {
        uint256 policyId;
        address farmer;
        uint256 premium;
        uint256 coverageAmount;
        uint256 startDate;
        uint256 endDate;
        bool isActive;
    }

    struct Claim {
        uint256 claimId;
        uint256 policyId;
        address farmer;
        uint256 claimAmount;
        string reason;
        ClaimStatus status;
    }

    address public insurer;
    address public oracle;
    uint256 public policyCounter;
    uint256 public claimCounter;

    mapping(address => Role) public roles;
    mapping(uint256 => Policy) public policies;
    mapping(uint256 => Claim) public claims;
    mapping(address => uint256[]) public farmerPolicies;
    mapping(uint256 => address) public claimDisputes;

    event PolicyPurchased(uint256 policyId, address indexed farmer, uint256 premium, uint256 coverageAmount);
    event ClaimFiled(uint256 claimId, uint256 policyId, address indexed farmer, uint256 claimAmount, string reason);
    event ClaimApproved(uint256 claimId, uint256 policyId, address indexed farmer, uint256 claimAmount);
    event ClaimRejected(uint256 claimId, uint256 policyId, address indexed farmer, uint256 claimAmount);
    event DisputeResolved(uint256 claimId, uint256 policyId, address indexed auditor, bool isApproved);

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Not authorized");
        _;
    }

    modifier onlyInsurer() {
        require(roles[msg.sender] == Role.Insurer, "Only insurer can call this function");
        _;
    }

    constructor(address _oracle) {
        insurer = msg.sender;
        oracle = _oracle;
        roles[msg.sender] = Role.Insurer;
    }

    function assignRole(address _account, Role _role) external onlyInsurer {
        roles[_account] = _role;
    }

    function purchasePolicy(uint256 _coverageAmount, uint256 _startDate, uint256 _endDate) external payable onlyRole(Role.Farmer) {
        uint256 premiumRate = IOracle(oracle).getPremiumRate();
        uint256 premium = (_coverageAmount * premiumRate) / 100;
        require(msg.value == premium, "Premium amount does not match");

        policyCounter++;
        policies[policyCounter] = Policy({
            policyId: policyCounter,
            farmer: msg.sender,
            premium: premium,
            coverageAmount: _coverageAmount,
            startDate: _startDate,
            endDate: _endDate,
            isActive: true
        });

        farmerPolicies[msg.sender].push(policyCounter);

        emit PolicyPurchased(policyCounter, msg.sender, premium, _coverageAmount);
    }

    function fileClaim(uint256 _policyId, uint256 _claimAmount, string memory _reason) external onlyRole(Role.Farmer) {
        Policy storage policy = policies[_policyId];
        require(policy.farmer == msg.sender, "Only policy owner can file claim");
        require(policy.isActive, "Policy is not active");
        require(block.timestamp >= policy.startDate && block.timestamp <= policy.endDate, "Policy not active");
        require(_claimAmount > 0, "Invalid claim amount");
        // require(_claimAmount == policies[_policyId].premium/2, "Invalid claim amount");

        claimCounter++;
        claims[claimCounter] = Claim({
            claimId: claimCounter,
            policyId: _policyId,
            farmer: msg.sender,
            claimAmount: _claimAmount,
            reason: _reason,
            status: ClaimStatus.Pending
        });

        emit ClaimFiled(claimCounter, _policyId, msg.sender, _claimAmount, _reason);
    }

    function approveClaim(uint256 _claimId) external onlyRole(Role.Insurer) {
        Claim storage claim = claims[_claimId];
        Policy storage policy = policies[claim.policyId];
        require(claim.status == ClaimStatus.Pending, "Claim already processed");
        require(policy.isActive, "Policy is not active");

        claim.status = ClaimStatus.Approved;
        policy.isActive = false;
        payable(policy.farmer).transfer(claim.claimAmount);

        emit ClaimApproved(_claimId, claim.policyId, policy.farmer, claim.claimAmount);
    }

    function rejectClaim(uint256 _claimId) external onlyRole(Role.Insurer) {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Pending, "Claim already processed");

        claim.status = ClaimStatus.Rejected;

        emit ClaimRejected(_claimId, claim.policyId, claim.farmer, claim.claimAmount);
    }

    function resolveDispute(uint256 _claimId, bool _isApproved) external onlyRole(Role.Auditor) {
        Claim storage claim = claims[_claimId];
        Policy storage policy = policies[claim.policyId];
        require(claim.status == ClaimStatus.Rejected, "Claim already processed");
        require(claimDisputes[_claimId] == address(0), "Dispute already resolved");

        claimDisputes[_claimId] = msg.sender;

        if (_isApproved) {
            claim.status = ClaimStatus.Approved;
            policy.isActive = false;
            payable(policy.farmer).transfer(claim.claimAmount);
            emit ClaimApproved(_claimId, claim.policyId, policy.farmer, claim.claimAmount);
        } else {
            claim.status = ClaimStatus.Rejected;
            emit ClaimRejected(_claimId, claim.policyId, claim.farmer, claim.claimAmount);
        }

        emit DisputeResolved(_claimId, claim.policyId, msg.sender, _isApproved);
    }

    function getFarmerPolicies(address _farmer) external view returns (uint256[] memory) {
        return farmerPolicies[_farmer];
    }

    // Receive function to handle plain Ether transfers
    receive() external payable {
        // Custom logic can be added here if needed
    }

    // Fallback function to handle calls to non-existent functions
    fallback() external payable {
        // Custom logic can be added here if needed
    }
}
