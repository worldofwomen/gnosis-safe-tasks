// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Canary is ERC721, Ownable {

    uint256 private index;

    constructor() ERC721("Canary", "CANARY") {
        index = 100;
    }

    function getIndex() external view returns(uint256) {
        return index;
    }

    function incrementIndex() external onlyOwner returns(uint256) {
        return (++index);
    }

    function decrementIndex() external onlyOwner returns(uint256) {
        return (--index);
    }

    function resetIndex() external onlyOwner returns(uint256) {
        index = 100;
        return index;
    }
}