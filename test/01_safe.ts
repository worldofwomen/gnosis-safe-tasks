"use strict";

import "@nomiclabs/hardhat-ethers";
import { Contract, Signer } from "ethers";
import { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import chai from "chai";
import { expect } from "chai";

import { getCompatFallbackHandler, getSafeWithOwners } from "./utils/setup";

// We have to use the following lines/import for TS to get the waffle assumptions.
chai.use(solidity);

describe("Test WoWDrips contract", async () => {
  let deployer: Signer, admin: Signer, user1: Signer, user2: Signer;
  let safe: Contract;
  let ownerSafe: Contract;

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    // const Erc1155 = await ethers.getContractFactory("ERC1155Token");
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
    };
  });

  // Moving from a before to a beforeEach as we want a clean state for every test
  beforeEach(async () => {
    [deployer, admin, user1, user2] = await ethers.getSigners();

    // Deploy our contracts
    const data = await setupTests();
    ({ safe, ownerSafe } = data);
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

  // describe("Interactions when not the owner", () => {
  //   it("Shouldn't be possible to set contract address or toggle boolean", async () => {
  //     await expect(
  //       wowDrips
  //         .connect(signer2)
  //         .setAuthorizedContractForToken(0, wowDrips.address)
  //     ).to.be.reverted;

  //     await expect(wowDrips.connect(signer2).toggleMigrationForToken(0)).to.be
  //       .reverted;
  //   });

  //   it("Shouldn't be possible for non-owner to mint tokens", async () => {
  //     let tokenId = 0;
  //     let receivers: Address[] = [await signer1.getAddress()];

  //     await expect(wowDrips.connect(signer1).mint(tokenId, [3], receivers)).to
  //       .be.reverted;
  //   });

  //   it("Shouldn't be possible for non-owner to set tokenURI", async () => {
  //     await expect(wowDrips.connect(signer1).setURI(`http://wow.test/{id}`)).to
  //       .be.reverted;
  //   });
  // });
});
