import { HardhatRuntimeEnvironment } from "hardhat/types";
import prompt from "prompt";

module.exports = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, getChainId, ethers } = hre;
  const { log, deploy } = deployments;

  const { deployer, admin, user1, user2 } = await getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer);
  const chainId = await getChainId();

  console.log("\n==== Contract properties =====");
  console.log("==============================\n");

  if (
    hre.hardhatArguments.network == "mainnet" ||
    hre.hardhatArguments.network == "goerli"
  ) {
    console.log("Is this ok? [y/N]");

    const { ok } = await prompt.get(["ok"]);
    if (ok !== "y") {
      console.log("Quitting!");
      process.exit();
    }
  }

  const wowTx = await deploy("WorldOfWomen", {
    args: [],
    from: deployer,
    log: true,
  });

  if (chainId == "1337") {
    log("Local network detected! Preparing wow contract...");
  }
};
module.exports.tags = ["all", "wow"];
