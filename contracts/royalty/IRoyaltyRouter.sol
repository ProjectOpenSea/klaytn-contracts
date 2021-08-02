pragma solidity ^0.5.0;

contract IRoyaltyRouter {
  event RoyaltyOverride(address indexed operator, address indexed nftContract, address royaltyContract);

  function getOverrideAddress(address nftContract) public view returns (address);
  function overrideAddress(address nftContract, address royaltyContract) public;

  function getRoyalty(address nftContract, uint256 tokenId, uint256 value) public view 
    returns(address payable[] memory royaltyReceivers, uint256[] memory royalties);
}