pragma solidity ^0.5.0;

import "../access/roles/MinterRole.sol";
import "./IRoyaltyRouter.sol";
import "./IRoyaltyRegistry.sol";

contract RoyaltyRouter is IRoyaltyRouter {

  mapping(address=>address) _royaltyInfoOverride;

  function overrideAddress(address nftContract, address royaltyContract) public {
    require(MinterRole(nftContract).isMinter(msg.sender), "RoyaltyRegistry: not a minter of nft contract");

    _royaltyInfoOverride[nftContract] = royaltyContract;

    emit RoyaltyOverride(msg.sender, nftContract, royaltyContract);
  }

  function getOverrideAddress(address nftContract) public view returns (address) {
    return _royaltyInfoOverride[nftContract];
  }

  function getRoyalty(address nftContract, uint256 tokenId, uint256 value) public view 
      returns(address payable[] memory recipients, uint256[] memory amounts) {
    address royaltyContract = nftContract;

    if(_royaltyInfoOverride[nftContract] != address(0)) {
      royaltyContract = _royaltyInfoOverride[nftContract];
    }
    
    return IRoyaltyRegistry(royaltyContract).getRoyalty(nftContract, tokenId, value);
  }

}