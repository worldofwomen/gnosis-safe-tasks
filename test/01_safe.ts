"use strict";

import "@nomiclabs/hardhat-ethers";
import { Contract, Signer } from "ethers";
import { ethers, deployments } from "hardhat";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { AddressZero } from "@ethersproject/constants";
import { defaultAbiCoder } from "@ethersproject/abi";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { expect } from "chai";

import {
  getCompatFallbackHandler,
  getSafeWithOwners,
  WorldOfWomenContract,
} from "./utils/setup";
import {
  buildSignatureBytes,
  signHash,
} from "@gnosis.pm/safe-contracts/dist/utils/execution";

// We have to use the following lines/import for TS to get the waffle assumptions.
chai.use(solidity);

describe("Test WoW contract", async () => {
  let deployer: Signer, admin: Signer, user1: Signer, user2: Signer;
  let safe: Contract;
  let ownerSafe: Contract;
  let wow: Contract;
  let messageHandler: Contract;

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();

    const handler = await getCompatFallbackHandler();
    const ownerSafe = await getSafeWithOwners(
      [await user1.getAddress(), await user2.getAddress()],
      2,
      handler.address
    );
    const messageHandler = handler.attach(ownerSafe.address);
    return {
      safe: await getSafeWithOwners(
        [ownerSafe.address, await user1.getAddress()],
        1
      ),
      ownerSafe,
      messageHandler,
      wow: await WorldOfWomenContract(),
    };
  });

  // Moving from a before to a beforeEach as we want a clean state for every test
  beforeEach(async () => {
    [deployer, admin, user1, user2] = await ethers.getSigners();

    // Deploy our contracts
    const data = await setupTests();
    ({ safe, ownerSafe, messageHandler, wow } = data);
  });

  describe("Deployment", () => {
    it("Check safe address", async () => {
      expect((await safe.getOwners()).join(",")).to.equal(
        [ownerSafe.address, await user1.getAddress()].join(",")
      );
      expect(await safe.getThreshold()).to.equal(1);
      expect(await safe.nonce()).to.equal(0);

      expect(await safe.VERSION()).to.equal(`1.3.0`);
    });
  });

  describe("Interactions", () => {
    it("Should be possible to send money to the safe", async () => {
      // Deposit 1 ETH + some spare money for execution
      await user1.sendTransaction({
        to: safe.address,
        value: ethers.utils.parseEther("1"),
      });
      await expect(
        await ethers.provider.getBalance(safe.address)
      ).to.be.deep.eq(ethers.utils.parseEther("1"));
    });

    it("transfer wow ownership and flipsale", async () => {
      const txResponse: TransactionResponse = await wow
        .connect(deployer)
        .transferOwnership(safe.address);
      await txResponse.wait();

      expect(await wow.owner()).to.be.equal(safe.address);

      const unsignedTx = await wow.populateTransaction.flipSaleStarted();

      const operation = 0;
      const to = wow.address;
      const value = ethers.utils.parseEther("0");
      const data = unsignedTx.data;
      const nonce = await safe.nonce();
      const messageData = await safe.encodeTransactionData(
        to,
        value,
        data,
        operation,
        0,
        0,
        0,
        AddressZero,
        AddressZero,
        nonce
      );
      const messageHash = await messageHandler.getMessageHash(messageData);
      const ownerSigs = await buildSignatureBytes([
        await signHash(user1, messageHash),
        await signHash(user2, messageHash),
      ]);
      const encodedOwnerSigns = defaultAbiCoder
        .encode(["bytes"], [ownerSigs])
        .slice(66);
      const sigs =
        "0x" +
        "000000000000000000000000" +
        ownerSafe.address.slice(2) +
        "0000000000000000000000000000000000000000000000000000000000000041" +
        "00" + // r, s, v
        encodedOwnerSigns;

      await safe.execTransaction(
        to,
        value,
        data,
        operation,
        0,
        0,
        0,
        AddressZero,
        AddressZero,
        sigs
      );

      const saleStarted: boolean = await wow.saleStarted();
      expect(saleStarted).to.be.equal(true);
    });
  });
});
