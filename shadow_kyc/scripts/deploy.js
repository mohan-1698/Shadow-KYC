const hre = require("hardhat");

async function main() {
  console.log("========================================");
  console.log("   ZKProofStorage Deployment Script");
  console.log("========================================\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Contract addresses (update these!)
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS || "0x0000000000000000000000000000000000000000";
  const CREDENTIALS_ADDRESS = process.env.CREDENTIALS_ADDRESS || "0x0000000000000000000000000000000000000000";

  if (VERIFIER_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("❌ ERROR: VERIFIER_ADDRESS not set in environment variables");
    console.log("Please deploy Groth16Verifier first and set VERIFIER_ADDRESS");
    process.exit(1);
  }

  if (CREDENTIALS_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.error("❌ ERROR: CREDENTIALS_ADDRESS not set in environment variables");
    console.log("Please deploy UserCredentials first and set CREDENTIALS_ADDRESS");
    process.exit(1);
  }

  console.log("Verifier contract:", VERIFIER_ADDRESS);
  console.log("Credentials contract:", CREDENTIALS_ADDRESS);
  console.log("\nDeploying ZKProofStorage...\n");

  const ZKProofStorage = await hre.ethers.getContractFactory("ZKProofStorage");
  const zkProofStorage = await ZKProofStorage.deploy(
    VERIFIER_ADDRESS,
    CREDENTIALS_ADDRESS
  );

  await zkProofStorage.waitForDeployment();
  const deployedAddress = await zkProofStorage.getAddress();

  console.log("✅ ZKProofStorage deployed to:", deployedAddress);
  console.log("\n========================================");
  console.log("   DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log(`Contract Address: ${deployedAddress}`);
  console.log(`Network: ${(await hre.ethers.provider.getNetwork()).name}`);
  console.log(`Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Block Number: ${await hre.ethers.provider.getBlockNumber()}`);
  console.log("\n📝 Update your .env with:");
  console.log(`ZKPROOF_STORAGE_ADDRESS=${deployedAddress}`);
  console.log("\n🔗 View on Sepolia Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${deployedAddress}`);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    contractName: "ZKProofStorage",
    address: deployedAddress,
    network: "sepolia",
    chainId: 11155111,
    verifierAddress: VERIFIER_ADDRESS,
    credentialsAddress: CREDENTIALS_ADDRESS,
    deployer: deployer.address,
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n✅ Deployment info saved to deployment-info.json");

  // Verify on Etherscan (optional)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\n⏳ Waiting 5 seconds before verification...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("📊 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: deployedAddress,
        constructorArguments: [VERIFIER_ADDRESS, CREDENTIALS_ADDRESS],
      });
      console.log("✅ Contract verified on Etherscan!");
    } catch (err) {
      console.log("⚠️  Verification failed (you can verify manually)");
      console.log(err.message);
    }
  }

  console.log("\n========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
