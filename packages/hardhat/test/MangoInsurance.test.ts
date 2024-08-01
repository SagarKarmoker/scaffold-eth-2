import { ethers } from "hardhat";
import { expect } from "chai";

describe("MangoInsurance", function () {
  let mangoInsurance: any;
  let oracle: any;
  let insurer: any;
  let farmer1: any;
  let farmer2: any;
  let auditor: any;
  let accounts: any;

  beforeEach(async function () {
    // Get the signers
    accounts = await ethers.getSigners();
    insurer = accounts[0];
    farmer1 = accounts[1];
    farmer2 = accounts[2];
    auditor = accounts[3];

    // Deploy a mock oracle
    const OracleFactory = await ethers.getContractFactory("MockOracle");
    oracle = await OracleFactory.deploy();
    await oracle.waitForDeployment();
    console.log("Oracle deployed at:", await oracle.getAddress());

    // Deploy the MangoInsurance contract
    const MangoInsuranceFactory = await ethers.getContractFactory("MangoInsurance");
    mangoInsurance = await MangoInsuranceFactory.deploy(await oracle.getAddress());
    await mangoInsurance.waitForDeployment();
    console.log("MangoInsurance deployed at:", await mangoInsurance.getAddress());

    // Set roles
    await mangoInsurance.connect(insurer).assignRole(farmer1.address, 0); // Role.Farmer
    await mangoInsurance.connect(insurer).assignRole(farmer2.address, 0); // Role.Farmer
    await mangoInsurance.connect(insurer).assignRole(auditor.address, 2); // Role.Auditor
  });

  it("should allow farmers to purchase policies", async function () {
    // Set the premium rate in the mock oracle
    await oracle.setPremiumRate(10); // 10%

    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later

    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    const policy = await mangoInsurance.policies(1);
    expect(policy.farmer).to.equal(farmer1.address);
    expect(policy.coverageAmount).to.equal(coverageAmount);
    expect(policy.isActive).to.be.true;
  });

  it("should not allow farmers to purchase policies with invalid coverage amount", async function () {
    // Set the premium rate in the mock oracle
    await oracle.setPremiumRate(10); // 10%

    const coverageAmount = 0; // invalid coverage amount
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later

    await expect(
      mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
        value: ethers.parseEther("0.1"), // 10% of coverageAmount
      }),
    ).to.be.revertedWith("Invalid coverage amount");
  });

  it("should allow farmers to file claims", async function () {
    // Set the premium rate and purchase a policy first
    await oracle.setPremiumRate(10); // 10%
    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later
    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    const claimAmount = ethers.parseEther("0.5"); // 50% of coverageAmount
    await mangoInsurance.connect(farmer1).fileClaim(1, claimAmount, "Sample reason");

    const claim = await mangoInsurance.claims(1);
    expect(claim.farmer).to.equal(farmer1.address);
    expect(claim.claimAmount).to.equal(claimAmount);
    expect(claim.status).to.equal(0); // Pending
  });

  it("should not allow farmers to file claims with invalid claim amount", async function () {
    // Set the premium rate and purchase a policy first
    await oracle.setPremiumRate(10); // 10%
    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later
    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    const claimAmount = 0; // invalid claim amount
    await expect(mangoInsurance.connect(farmer1).fileClaim(1, claimAmount, "Sample reason")).to.be.revertedWith(
      "Invalid claim amount",
    );
  });

  it("should allow insurer to approve claims", async function () {
    // Set the premium rate and purchase a policy
    await oracle.setPremiumRate(10); // 10%
    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later
    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    // File a claim
    const claimAmount = ethers.parseEther("0.5"); // 50% of coverageAmount
    await mangoInsurance.connect(farmer1).fileClaim(1, claimAmount, "Sample reason");

    // Approve the claim
    await mangoInsurance.connect(insurer).approveClaim(1);

    const claim = await mangoInsurance.claims(1);
    expect(claim.status).to.equal(1); // Approved
  });

  it("should not allow insurer to approve claims that are not pending", async function () {
    // Set the premium rate and purchase a policy
    await oracle.setPremiumRate(10); // 10%
    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later
    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    // File a claim
    const claimAmount = ethers.parseEther("0.5"); // 50% of coverageAmount
    await mangoInsurance.connect(farmer1).fileClaim(1, claimAmount, "Sample reason");

    // Approve the claim
    await mangoInsurance.connect(insurer).approveClaim(1);

    // Try to approve the claim again
    await expect(mangoInsurance.connect(insurer).approveClaim(1)).to.be.revertedWith("Claim is not pending");
  });

  it("should allow auditor to resolve disputes", async function () {
    // Set the premium rate and purchase a policy
    await oracle.setPremiumRate(10); // 10%
    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later
    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    // File a claim
    const claimAmount = ethers.parseEther("0.5"); // 50% of coverageAmount
    await mangoInsurance.connect(farmer1).fileClaim(1, claimAmount, "Sample reason");

    // Reject the claim by the insurer
    await mangoInsurance.connect(insurer).rejectClaim(1);

    // Resolve the dispute by the auditor
    await mangoInsurance.connect(auditor).resolveDispute(1, true);

    const claim = await mangoInsurance.claims(1);
    expect(claim.status).to.equal(1); // Approved
  });

  it("should not allow auditor to resolve disputes that are not pending", async function () {
    // Set the premium rate and purchase a policy
    await oracle.setPremiumRate(10); // 10%
    const coverageAmount = ethers.parseEther("1.0"); // 1 ETH
    const startDate = Math.floor(Date.now() / 1000);
    const endDate = startDate + 3600 * 24 * 30; // 30 days later
    await mangoInsurance.connect(farmer1).purchasePolicy(coverageAmount, startDate, endDate, {
      value: ethers.parseEther("0.1"), // 10% of coverageAmount
    });

    // File a claim
    const claimAmount = ethers.parseEther("0.5"); // 50% of coverageAmount
    await mangoInsurance.connect(farmer1).fileClaim(1, claimAmount, "Sample reason");

    // Approve the claim
    await mangoInsurance.connect(insurer).approveClaim(1);

    // Try to resolve the dispute
    await expect(mangoInsurance.connect(auditor).resolveDispute(1, true)).to.be.revertedWith("Claim is not pending");
  });
});
