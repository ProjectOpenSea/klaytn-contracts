pragma solidity ^0.5.0;

import "../math/SafeMath.sol";
import "./IRoyaltyRegistry.sol";
import "../token/KIP17/IKIP17.sol";
import "../access/roles/CreatorRole.sol";

contract RoyaltyRegistry is IRoyaltyRegistry {
  using SafeMath for uint256;

  uint256 constant BASIS_POINT_DENOM = 100000;

  mapping(address=>mapping(uint256=>address payable[])) _royaltyReceivers;
  mapping(address=>mapping(uint256=>uint256[])) _ratioInBp;

  function setRoyalty(address nftContract, uint256 tokenId, address payable[] memory royaltyReceivers, uint256[] memory ratiosInBp) public {
    require(royaltyReceivers.length == ratiosInBp.length, "RoyaltyRegistry: length not matched: royaltyReceivers, reatiosInBp");
    require(CreatorRole(nftContract).creatorOf(tokenId) == msg.sender, "RoyaltyRegistry: not creator");
    require(IKIP17(nftContract).ownerOf(tokenId) == msg.sender, "RoyaltyRegistry: not owner");
    _royaltyReceivers[nftContract][tokenId] = royaltyReceivers;
    _ratioInBp[nftContract][tokenId] = ratiosInBp;

    emit RoyaltySet(nftContract, tokenId, royaltyReceivers, ratiosInBp);
  }

  function getRoyalty(address nftContract, uint256 tokenId, uint256 value) public view 
      returns(address payable[] memory royaltyReceivers, uint256[] memory royalties) {

    royaltyReceivers = _royaltyReceivers[nftContract][tokenId];
    royalties = new uint256[](royaltyReceivers.length);
    for(uint256 i = 0; i < royaltyReceivers.length; i++) {
      royalties[i] = value * _ratioInBp[nftContract][tokenId][i] / BASIS_POINT_DENOM;
    }

    return (royaltyReceivers, royalties);
  }

}