// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Context.sol";


//               ,{{}}}}}}.
//              {{{{{}}}}}}}.
//             {{{{  {{{{{}}}}
//            }}}}} _   _ {{{{{
//            }}}}  m   m  }}}}}
//           {{{{C    ^    {{{{{
//          }}}}}}\  '='  /}}}}}}
//         {{{{{{{{;.___.;{{{{{{{{
//         }}}}}}}}})   (}}}}}}}}}}
//        {{{{}}}}}':   :{{{{{{{{{{
//        {{{}}}}}}  `@` {{{}}}}}}}
//         {{{{{{{{{    }}}}}}}}}
//           }}}}}}}}  {{{{{{{{{
//            {{{{{{{{  }}}}}}
//               }}}}}  {{{{
//                {{{    }}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor(address owner_) {
        _transferOwnership(owner_);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


contract WorldOfWomen is ERC721, ERC721Enumerable, Ownable {

    using SafeMath for uint256;

    uint256 public constant maxSupply = 10000;
    uint256 private _price = 0.0001 ether;
    uint256 private _reserved = 20;

    string public WOW_PROVENANCE = "";
    uint256 public startingIndex;

    bool private _saleStarted;
    string public baseURI;

    // Team addresses
    address t1 = 0x46d9Ea7A4D1E4AEAE351Ad3673697a7Dd035e668;
    address t2 = 0xEa8fb8EF1b91EC2EAbA81419523E8672e47CB9E0;

    constructor(address owner) ERC721("World Of Women", "WOW") Ownable(owner) {
        _saleStarted = false;
    }

    modifier whenSaleStarted() {
        require(_saleStarted);
        _;
    }

    function flipSaleStarted() external onlyOwner {
        _saleStarted = !_saleStarted;

        if (_saleStarted && startingIndex == 0) {
            setStartingIndex();
        }
    }

    function saleStarted() public view returns(bool) {
        return _saleStarted;
    }

    function setBaseURI(string memory _URI) external onlyOwner {
        baseURI = _URI;
    }

    function _baseURI() internal view override(ERC721) returns(string memory) {
        return baseURI;
    }

    // Make it possible to change the price: just in case
    function setPrice(uint256 _newPrice) external onlyOwner {
        _price = _newPrice;
    }

    function getPrice() public view returns (uint256){
        return _price;
    }

    // This should be set before sales open.
    function setProvenanceHash(string memory provenanceHash) public onlyOwner {
        WOW_PROVENANCE = provenanceHash;
    }

    // Helper to list all the Women of a wallet
    function walletOfOwner(address _owner) public view returns(uint256[] memory) {
        uint256 tokenCount = balanceOf(_owner);

        uint256[] memory tokensId = new uint256[](tokenCount);
        for(uint256 i; i < tokenCount; i++){
            tokensId[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokensId;
    }

    function claimReserved(uint256 _number, address _receiver) external onlyOwner {
        require(_number <= _reserved, "That would exceed the max reserved.");

        uint256 _tokenId = totalSupply();
        for (uint256 i = 0; i < _number; i++) {
            _safeMint(_receiver, _tokenId + i);
        }

        _reserved = _reserved - _number;
    }

    function mint(uint256 _nbTokens) external payable whenSaleStarted {
        uint256 supply = totalSupply();
        require(_nbTokens < 21, "You cannot mint more than 20 Tokens at once!");
        require(supply + _nbTokens <= maxSupply - _reserved, "Not enough Tokens left.");
        require(_nbTokens * _price <= msg.value, "Inconsistent amount sent!");

        for (uint i = 0; i < _nbTokens; i++) {
            _safeMint(msg.sender, supply + i);
        }
    }

    function setStartingIndex() public {
        require(startingIndex == 0, "Starting index is already set");

        // BlockHash only works for the most 256 recent blocks.
        uint256 _block_shift = uint(keccak256(abi.encodePacked(block.difficulty, block.timestamp)));
        _block_shift =  1 + (_block_shift % 255);

        // This shouldn't happen, but just in case the blockchain gets a reboot?
        if (block.number < _block_shift) {
            _block_shift = 1;
        }

        uint256 _block_ref = block.number - _block_shift;
        startingIndex = uint(blockhash(_block_ref)) % maxSupply;

        // Prevent default sequence
        if (startingIndex == 0) {
            startingIndex = startingIndex + 1;
        }
    }

    function withdraw() public onlyOwner {
        uint256 _balance = address(this).balance;
        uint256 _split = _balance * 62 / 100;

        if (_split > 0) {
            require(payable(t1).send(_split));
        }

        require(payable(t2).send(_balance.sub(_split)));
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}