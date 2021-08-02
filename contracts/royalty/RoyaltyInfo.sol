pragma solidity ^0.5.0;

import "../math/SafeMath.sol";
import "./IRoyaltyInfo.sol";
import "../token/KIP17/IKIP17.sol";
import "../access/roles/CreatorRole.sol";

contract RoyaltyInfo is IRoyaltyInfo {
  using SafeMath for uint256;

  uint256 constant BASIS_POINT_DENOM = 100000;

  mapping(uint256=>address payable[]) private _royaltyReceivers;
  mapping(uint256=>uint256[]) private _ratioInBp;
  address private _nftContract;

  constructor(address nft) public {
    _nftContract = nft;
  }

  function setRoyalty(uint256 tokenId, address payable[] memory royaltyReceivers, uint256[] memory ratiosInBp) public {
    require(royaltyReceivers.length == ratiosInBp.length, "RoyaltyInfo: length not matched: royaltyReceivers, reatiosInBp");
    require(CreatorRole(_nftContract).creatorOf(tokenId) == msg.sender, "RoyaltyInfo: not creator");
    require(IKIP17(_nftContract).ownerOf(tokenId) == msg.sender, "RoyaltyInfo: not owner");
    _royaltyReceivers[tokenId] = royaltyReceivers;
    _ratioInBp[tokenId] = ratiosInBp;

    emit RoyaltySet(tokenId, royaltyReceivers, ratiosInBp);
  }

  function getRoyalty(uint256 tokenId, uint256 value) public view 
      returns(address payable[] memory royaltyReceivers, uint256[] memory royalties) {

    royaltyReceivers = _royaltyReceivers[tokenId];
    royalties = new uint256[](royaltyReceivers.length);
    for(uint256 i = 0; i < royaltyReceivers.length; i++) {
      royalties[i] = value * _ratioInBp[tokenId][i] / BASIS_POINT_DENOM;
    }

    return (royaltyReceivers, royalties);
  }

}