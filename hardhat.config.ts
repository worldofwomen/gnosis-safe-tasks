import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import dotenv from "dotenv";
import type { HardhatUserConfig, HttpNetworkUserConfig } from "hardhat/types";
import yargs from "yargs";

const argv = yargs
  .option("network", {
    type: "string",
    default: "hardhat",
  })
  .help(false)
  .version(false).argv;

// Load environment variables.
dotenv.config();
const {
  NETWORK,
  NODE_URL,
  ALCHEMY_KEY,
  MNEMONIC,
  PK,
  SOLIDITY_VERSION,
  SOLIDITY_SETTINGS,
} = process.env;

const DEFAULT_MNEMONIC =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

if (
  ["mainnet", "rinkeby", "kovan", "goerli"].includes(argv.network) &&
  ALCHEMY_KEY === undefined
) {
  throw new Error(
    `Could not find Infura key in env, unable to connect to network ${argv.network}`
  );
}

import "./src/tasks";

const primarySolidityVersion = SOLIDITY_VERSION || "0.7.6";
const soliditySettings = !!SOLIDITY_SETTINGS
  ? JSON.parse(SOLIDITY_SETTINGS)
  : undefined;

const userConfig: HardhatUserConfig = {
  paths: {
    artifacts: "build/artifacts",
    cache: "build/cache",
    sources: "contracts",
  },
  solidity: {
    compilers: [
      { version: primarySolidityVersion, settings: soliditySettings },
      { version: "0.8.1" }, // Added to compile the WoW contract
      { version: "0.6.12" },
      { version: "0.5.17" },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      gas: 100000000,
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${ALCHEMY_KEY}`,
    },
    goerli: {
      ...sharedNetworkConfig,
      url: `https://eth-goerli.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    },
  },
  namedAccounts: {
    deployer: 0,
    admin: 1,
    user1: 2,
    user2: 3,
  },
  mocha: {
    timeout: 2000000,
  },
};
if (NETWORK) {
  userConfig.defaultNetwork = NETWORK;
}
if (NODE_URL) {
  userConfig.networks!!.custom = {
    ...sharedNetworkConfig,
    url: NODE_URL,
  };
}
export default userConfig;
