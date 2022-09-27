# How to deploy a contract with a Gnosis safe

## Prequisite

Before diving in, quick reminder on the EVM memory layouts, they are 3:

- CALLDATA: read-only byte-addressable space where the data parameter of a transaction or call is held
- MEMORY: volatile read-write byte-addressable space mainly used to store data during execution
- STORAGE: persistent read-write word-addressable space. This is where each contract stores its persistent information

## Create2

For more information on create2 check the wiki: https://github.com/worldofwomen/wiki/wiki/Create2

## Deterministic deployment proxy

From the `create2` wiki above we've seen that the addresse is computed in the following way: `hash(addr, salt, bytecode)`. For a given contract and a fixed salt, one also needs a constant `address` if one wants to predict where the contract will be created.

Let's look at the archnid version of such an on-chain deployer: https://github.com/Arachnid/deterministic-deployment-proxy/blob/master/source/deterministic-deployment-proxy.yul
(FYI: this is [YUL](https://docs.soliditylang.org/en/latest/yul.html) an intermediate language that can be compiled to bytecode for different backends.)
EVM dialect: https://docs.soliditylang.org/en/v0.8.17/yul.html#evm-dialect

at "runtime" (when the contract receive a transaction), let's look at what happens:

- `calldatacopy(0, 32, sub(calldatasize(), 32))`

  - `calldatacopy(t, f, s)`: copy `s bytes` from `calldata` at position `f` to `mem` at position `t`
  - `calldatasize()`: size of call data in bytes
  - let's note `S` the size in bytes of the full `calldata` memory: `S = calldatasize()`
  - Here, we copy `S - 32 bytes` data from the `calldata` memory layout at position `32` to the memory layout at position `0`

- `create2(callvalue(), 0, sub(calldatasize(), 32), calldataload(0))`

  - `callvalue()`: wei sent together with the current call
  - `calldataload(p)`: call data starting from position p (load exactly 32 bytes)
  - `create2(v, p, n, s)`: create new contract with code `mem[p…(p+n))` at address `keccak256(0xff . this . s . keccak256(mem[p…(p+n)))` and send v wei to the resulting address
    - `this` represents the `msg.sender`, when you call a deployer you can change it using a `delegatecall`
  - Here we load:
    - the amount of WEI sent with the transaction: `v = callvalue()`
    - the memory from `[0, S - 32]`: `p = 0, n = S - 32`
    - the calldata memory from `[0, 32]`: `s = calldataload(0)`

From these observations, we can easily concluded that the arachnid contract requires a transaction where the `calldata`, (i.e. the transaction data) must contains the salt and the bytecode of the contract we want to deploy in the following order: `tx.data = concat([salt32Bytes, bytecode])`

Just an ethereum reminder, a transaction contains the following data:

```
msg.data (bytes calldata): complete calldata
msg.sender (address): sender of the message (current call)
msg.sig (bytes4): first four bytes of the calldata (i.e. function identifier)
msg.value (uint): number of wei sent with the message
```

## Javascript and Hardhat

From the above, we know we need to make a transaction to the arachnid contract containing the bytecode of the contract (with the constructor arguments which are abi.encoded and appended at the end) and the salt.

Hopefully for us this is very easy to do with hardhat.

To get the full contract bytecode, you only need to:

- use hardhat to compile your contract `yarn hardhat compile`
- use hardhat to load the bytecode:

```js
const wowFactory = await hre.ethers.getContractFactory("MyContract");
const unsignedDeployTx = wowFactory.getDeployTransaction();
const hexFullBytecode = unsignedDeployTx.data;
```

For the salt, we can use `ethers` to create a bytes32 hex string:

```js
const salt = ethers.utils.formatBytes32String("mysalt");
```

Finally, we just need to concat those 2 variables to have the final calldata ready for the arachnid contract:

```js
const data = salt + unsignedDeployTx.data.slice(2);
```

Bonus: you can easily compute the deterministic address using `ethers`:

```js
console.log(
  "Predicted address",
  getCreate2Address(
    taskArgs.to,
    salt,
    ethers.utils.keccak256(unsignedDeployTx.data)
  )
);
```

## Gnosis

Let's not forget that our main goal was to use a Gnosis safe to deploy a contract, so the goal here is to make the Gnosis safe send the above calldata.

Gnosis safe are all about meta transaction which are simply transaction containing transactions.

If you look at the gnosis safe contract (`v1.3.0` at the time of writing) and check the `execTransaction` function: https://github.com/safe-global/safe-contracts/blob/v1.3.0/contracts/GnosisSafe.sol#L111

We see we bacically just send a transaction containing all the properties of a transaction in its `calldata` which are passed as parameters of the contract `execTransaction` function.

This function will then call the `execute` function define as follow:

```sol
contract Executor {
    function execute(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 txGas
    ) internal returns (bool success) {
        if (operation == Enum.Operation.DelegateCall) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                success := delegatecall(txGas, to, add(data, 0x20), mload(data), 0, 0)
            }
        } else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                success := call(txGas, to, value, add(data, 0x20), mload(data), 0, 0)
            }
        }
    }
}
```

In which we can mainly decide if we want to delegate the call or not.

### Proposals
