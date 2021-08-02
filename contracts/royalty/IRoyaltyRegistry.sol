pragma solidity ^0.5.0;


contract IRoyaltyRegistry {

  event RoyaltySet(address indexed nftContract, uint256 indexed tokenId, address payable[] receivers, uint256[] ratiosInBp);

  function getRoyalty(address nftContract, uint256 tokenId, uint256 value) public view 
    returns(address payable[] memory recipients, uint256[] memory amounts);

}