pragma solidity ^0.5.0;

contract IRoyaltyRouter {
  event RoyaltyOverride(address indexed operator, address indexed nftContract, address royaltyContract);

  function getOverrideAddress(address nftContract) public view returns (address);

}