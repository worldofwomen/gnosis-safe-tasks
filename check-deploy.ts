import { BigNumber, ethers, Transaction } from "ethers";

const executionFailureTopic = ethers.utils.id(
  "ExecutionFailure(bytes32,uint256)"
);
const executionSuccessTopic = ethers.utils.id(
  "ExecutionSuccess(bytes32,uint256)"
);
const approveHashTopic = ethers.utils.id("ApproveHash(bytes32,address)");
const ownershipTransferredTopic = ethers.utils.id(
  "OwnershipTransferred(address,address"
);

const GNOSIS_ADDR = "0x808D73Ae80052634C7E35a845522b2094A1F21d4";
const GNOSIS_DEPLOY_PROPOSAL_TX_HASH =
  "0xccbbdadb166c2da6b5aba300b5c7d815fa81d461031cc409b5a193b0933219dd";
const WOW_ADDRESS = "0x412ebA99bBA60637401b8017693F9877fd6f743e";

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    "http://127.0.0.1:8545/"
  );
  const { chainId } = await provider.getNetwork();
  const accounts = await provider.listAccounts();
  console.log(accounts);
  // for (let i = 0; i < accounts.length; i++) {
  for (let i = 0; i < 4; i++) {
    const account = accounts[i];
    const balance = ethers.utils.formatEther(
      await provider.getBalance(account)
    );
    console.log({ account, balance });
  }

  const gnosisBalance = ethers.utils.formatEther(
    await provider.getBalance(GNOSIS_ADDR)
  );
  console.log({ gnosisBalance });

  const txReponse = await provider.getTransaction(
    GNOSIS_DEPLOY_PROPOSAL_TX_HASH
  );
  if (txReponse) {
    const txReceipt = await txReponse.wait();
    console.log({ txReceipt });
    txReceipt.logs.forEach((log) => {
      console.log(log);
    });
    console.log({
      executionFailureTopic,
      executionSuccessTopic,
      approveHashTopic,
      ownershipTransferredTopic,
    });
  }

  //   const ExecutionFailureLog = txReceipt.logs.find(
  //     (log: any) => log.topics[0] === "executionFailureTopic"
  //   );
  //   console.log({ creationLog });

  const signer = provider.getSigner(accounts[0]);
  const signerBalance = ethers.utils.formatEther(
    await provider.getBalance(await signer.getAddress())
  );
  console.log({ signerBalance });

  //   const tx = {
  //     to: "0xAfE5d3D8C88387ef1F81564f244D7A4ed9853555",
  //     value: ethers.utils.parseEther("1.0"),
  //   };
  //   const txResponse = await signer.sendTransaction(tx);
  //   const txReceipt = await txResponse.wait();
  //   console.log({ txReceipt });

  const code = await provider.getCode(WOW_ADDRESS);
  console.log({ WOW_ADDRESS, code });
})();
