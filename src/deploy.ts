import { task, types } from "hardhat/config";
import { multiSendLib, safeSingleton } from "./contracts";
import {
  buildMultiSendSafeTx,
  buildSafeTransaction,
  calculateSafeTransactionHash,
  SafeTransaction,
  MetaTransaction,
} from "@gnosis.pm/safe-contracts";
import { parseEther } from "@ethersproject/units";
import { getAddress, isHexString } from "ethers/lib/utils";
import {
  proposalFile,
  readFromCliCache,
  writeToCliCache,
  writeTxBuilderJson,
} from "./execution/utils";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, ethers, utils } from "ethers";
import fs from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getCreate2Address } from "ethers/lib/utils";
import axios from "axios";
import {
  SafeSignature,
  safeSignMessage,
  signHash,
} from "@gnosis.pm/safe-contracts";
import { SafeTxProposal, calcSafeTxHash } from "./execution/proposing";

task("propose-deploy-wow", "Create a Safe tx proposal json file")
  .addPositionalParam(
    "address",
    "Address or ENS name of the Safe to check",
    undefined,
    types.string
  )
  .addParam("to", "Address of the create2 contract", undefined, types.string)
  .addFlag(
    "onChainHash",
    "Get hash from chain (required for pre-1.3.0 version)"
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`Running on ${hre.network.name}`);

    const safe = await safeSingleton(hre, taskArgs.address);
    const safeAddress = await safe.resolvedAddress;
    console.log(`Using Safe at ${safeAddress}`);

    const nonce = await safe.nonce();

    // Retrieve the WoW contract
    const wowFactory = await hre.ethers.getContractFactory("WorldOfWomen");
    const unsignedDeployTx = wowFactory.getDeployTransaction();
    let data;
    if (typeof unsignedDeployTx.data === "string") {
      const salt = ethers.utils.formatBytes32String("123456");
      // const salt =
      //   "0x0000000000000000000000000000000000000000000000000000000000000000";

      //   We have a problem here
      console.log(
        "Predicted address",
        getCreate2Address(
          taskArgs.to,
          salt,
          ethers.utils.keccak256(unsignedDeployTx.data)
        )
      );
      data = salt + unsignedDeployTx.data.slice(2);
    }

    if (!isHexString(data))
      throw Error(`Invalid hex string provided for data: ${data}`);

    const tx = buildSafeTransaction({
      to: taskArgs.to,
      value: 0,
      data: data,
      nonce: nonce.toString(),
      operation: 0, // do not delegate call, you want to use the address of the create2 contract to compute the future address
    });
    const chainId = (await safe.provider.getNetwork()).chainId;
    const safeTxHash = await calcSafeTxHash(
      safe,
      tx,
      chainId,
      taskArgs.onChainHash
    );
    const proposal: SafeTxProposal = {
      safe: safeAddress,
      chainId,
      safeTxHash,
      tx,
    };
    await writeToCliCache(proposalFile(safeTxHash), proposal);
    console.log(`Safe transaction hash: ${safeTxHash}`);
  });

const gnosisProposeTx = async (safe: string, tx: any): Promise<any> => {
  try {
    const URL = `https://safe-transaction.${process.env.NETWORK}.gnosis.io/api/v1/safes/${safe}/transactions/`;
    console.log(URL);
    const resp = await axios.post(URL, tx);
    console.log(resp.data);
    return resp.data;
  } catch (e) {
    if (e.response) console.log(JSON.stringify(e.response.data));
    throw e;
  }
};

task("send-proposal", "Create a Safe tx proposal json file")
  .addPositionalParam(
    "hash",
    "Hash of Safe transaction to display",
    undefined,
    types.string
  )
  .addParam("signerIndex", "Index of the signer to use", 0, types.int, true)
  .setAction(async (taskArgs, hre) => {
    const proposal: SafeTxProposal = await readFromCliCache(
      proposalFile(taskArgs.hash)
    );
    const signers = await hre.ethers.getSigners();
    const signer = signers[taskArgs.signerIndex];
    const safe = await safeSingleton(hre, proposal.safe);
    const safeAddress = await safe.resolvedAddress;
    console.log(`Using Safe at ${safeAddress} with ${signer.address}`);
    const owners: string[] = await safe.getOwners();
    if (owners.indexOf(signer.address) < 0) {
      throw Error(`Signer is not an owner of the Safe. Owners: ${owners}`);
    }

    const signature = await signHash(signer, taskArgs.hash);

    proposal.tx.to = ethers.utils.getAddress(proposal.tx.to);
    const toSend = {
      ...proposal.tx,
      sender: ethers.utils.getAddress(signer.address),
      contractTransactionHash: proposal.safeTxHash,
      signature: signature.data,
      origin: "hello UI!",
    };

    console.log(JSON.stringify({ toSend }));

    const { data } = await gnosisProposeTx(safeAddress, toSend);
    console.log({ data });
    console.log("Done?");
  });

task("transfer", "Transfer ownership")
  .addPositionalParam(
    "safeAddress",
    "Hash of Safe transaction to display",
    undefined,
    types.string
  )
  .addParam("signerIndex", "Index of the signer to use", 0, types.int, true)
  .setAction(async (taskArgs, hre) => {
    const signers = await hre.ethers.getSigners();
    const signer = signers[taskArgs.signerIndex];
    console.log(`Using Safe at ${taskArgs.safeAddress} with ${signer.address}`);

    const wowFactory = await hre.ethers.getContractFactory(
      "WorldOfWomen",
      signer
    );
    const wowContract = wowFactory.attach(
      "0x412ebA99bBA60637401b8017693F9877fd6f743e"
    );

    // const txResponse = await wowContract.transferOwnership(
    //   taskArgs.safeAddress
    // );
    // const txReceipt = await txResponse.wait();
    // console.log(txReceipt);
    console.log(await wowContract.owner());
  });
