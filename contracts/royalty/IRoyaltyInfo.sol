pragma solidity ^0.5.0;


contract IRoyaltyInfo {

  event RoyaltySet(uint256 indexed tokenId, address payable[] royaltyReceivers, uint256[] ratiosInBp);

  function setRoyalty(uint256 tokenId, address payable[] memory royaltyReceiver, uint256[] memory ratiosInBp) public;
  function getRoyalty(uint256 tokenId, uint256 value) public view 
    returns(address payable[] memory royaltyReceiver, uint256[] memory royalties);

}