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
  CanaryContract,
} from "./utils/setup";
import {
  buildSignatureBytes,
  signHash,
} from "@gnosis.pm/safe-contracts/dist/utils/execution";
import { option } from "yargs";

// We have to use the following lines/import for TS to get the waffle assumptions.
chai.use(solidity);

describe("Test Canary contract", async () => {
  let deployer: Signer, admin: Signer, user1: Signer, user2: Signer;
  let safe: Contract;
  let ownerSafe: Contract;
  let canary: Contract;
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
      canary: await CanaryContract(),
    };
  });

  // Moving from a before to a beforeEach as we want a clean state for every test
  beforeEach(async () => {
    [deployer, admin, user1, user2] = await ethers.getSigners();

    // Deploy our contracts
    const data = await setupTests();
    ({ safe, ownerSafe, messageHandler, canary } = data);
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

  describe("Basic Contract methods", () => {
    it("Should be able to increment/decrement/reset for owner", async () => {
      expect(await canary.getIndex()).to.equal(100);

      let txResponse, txReceipt;

      txResponse = await canary.connect(deployer).incrementIndex();
      txReceipt = await txResponse.wait();
      expect(await canary.getIndex()).to.equal(101);

      txResponse = await canary.connect(deployer).incrementIndex();
      txReceipt = await txResponse.wait();
      expect(await canary.getIndex()).to.equal(102);

      txResponse = await canary.connect(deployer).decrementIndex();
      txReceipt = await txResponse.wait();
      expect(await canary.getIndex()).to.equal(101);

      txResponse = await canary.connect(deployer).resetIndex();
      txReceipt = await txResponse.wait();
      expect(await canary.getIndex()).to.equal(100);
    });

    it("Should not be able to increment/decrement/reset for user", async () => {
      expect(await canary.getIndex()).to.equal(100);

      await expect(canary.connect(user1).incrementIndex()).to.be.reverted;

      await expect(canary.connect(user1).decrementIndex()).to.be.reverted;

      await expect(canary.connect(user1).resetIndex()).to.be.reverted;
    });

    it("Should be possible to transfer Ownership", async () => {
      let txResponse, txReceipt;

      txResponse = await canary
        .connect(deployer)
        .transferOwnership(safe.address);
      txReceipt = await txResponse.wait();
      expect(txReceipt.status).to.equal(1);
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

    it("transfer Canary ownership and increment", async () => {
      const txResponse: TransactionResponse = await canary
        .connect(deployer)
        .transferOwnership(safe.address);
      await txResponse.wait();

      expect(await canary.owner()).to.be.equal(safe.address);

      const unsignedTx = await canary.populateTransaction.incrementIndex();

      const operation = 0;
      const to = canary.address;
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

      const ind: number = await canary.getIndex();
      expect(ind).to.be.equal(101);
    });

    it("transfer Canary ownership and decrement", async () => {
      const txResponse: TransactionResponse = await canary
        .connect(deployer)
        .transferOwnership(safe.address);
      await txResponse.wait();

      expect(await canary.owner()).to.be.equal(safe.address);

      const unsignedTx = await canary.populateTransaction.decrementIndex();

      const operation = 0;
      const to = canary.address;
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

      const ind: number = await canary.getIndex();
      expect(ind).to.be.equal(99);
    });

    it("transfer Canary ownership and transfer it back to Deployer", async () => {
      const txResponse: TransactionResponse = await canary
        .connect(deployer)
        .transferOwnership(safe.address);
      await txResponse.wait();

      expect(await canary.owner()).to.be.equal(safe.address);

      const unsignedTx = await canary.populateTransaction.transferOwnership(
        await deployer.getAddress()
      );

      const operation = 0;
      const to = canary.address;
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

      expect(await canary.owner()).to.be.equal(await deployer.getAddress());
    });
  });
});
