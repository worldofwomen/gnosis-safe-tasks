import { HardhatRuntimeEnvironment } from "hardhat/types";

module.exports = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, getChainId, ethers } = hre;
  const { log, deploy } = deployments;

  const { deployer, admin, user1, user2 } = await getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer);
  const chainId = await getChainId();

  await deploy("Canary", {
    args: [],
    from: deployer,
    log: true,
  });
};
module.exports.tags = ["all", "canary"];
