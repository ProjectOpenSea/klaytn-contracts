pragma solidity ^0.5.0;

import "../../access/roles/OperatorRole.sol";
import "../../token/KIP17/IKIP17.sol";
import "../../token/KIP7/IKIP7.sol";
import "./IKIP17Escrow.sol";

contract KIP17Escrow is OperatorRole, IKIP17Escrow {
  struct Escrow {
    address payable seller;
    address priceContract;
    uint256 price;
    address payable buyer;
    address payable[] feeReceivers;
    uint256[] fees;
    uint256 expirationTime;
  }

  bytes4 private constant _KIP7_RECEIVED = 0x9d188c22;
  bytes4 private constant _KIP17_RECEIVED = 0x6745782b;

  mapping(address=>mapping(uint256=>Escrow)) _settlements;

  function openEscrow(address kip17Contract, uint256 tokenId, address payable seller, address priceContract,
      uint256 price, address payable buyer, address payable[] memory feeReceivers, uint256[] memory fees, uint256 expirationTime) public payable
      onlyOperator {
    require(feeReceivers.length == fees.length, "KIP17Escrow: length not matched: feeReceivers and fees");
    _settlements[kip17Contract][tokenId] = Escrow(seller, priceContract, price, buyer, feeReceivers, fees, expirationTime);

    emit EscrowOpened(kip17Contract, tokenId, seller, priceContract, price, buyer, feeReceivers, fees, expirationTime);
  }

  function getEscrow(address kip17Contract, uint256 tokenId) public view 
      returns (address payable seller, address priceContract, uint256 price, address payable buyer,
      address payable[] memory feeReceivers, uint256[] memory fees, uint256 expirationTime) {
    Escrow storage s = _settlements[kip17Contract][tokenId];
    return (s.seller, s.priceContract, s.price, s.buyer, s.feeReceivers, s.fees, s.expirationTime);
  }

  function revokeEscrow(address kip17Contract, uint256 tokenId) public {
    Escrow storage s = _settlements[kip17Contract][tokenId];
    require(isOperator(msg.sender) || msg.sender == s.seller || msg.sender == s.buyer, "KIP17Escrow: not allowed");
    require(now < s.expirationTime, "KIP17Escrow: already expired");

    IKIP17 kip17 = IKIP17(kip17Contract);
    address owner = kip17.ownerOf(tokenId);

    if(owner == address(this) || kip17.getApproved(tokenId) == address(this) 
        || kip17.isApprovedForAll(owner, address(this))) {
      // send the token to the seller.
      kip17.safeTransferFrom(owner, s.seller, tokenId);
    } else {
      revert("KIP17Escrow: failed to transfer nft to revert escrow");
    }

    if(s.priceContract == address(0)) {
      // in case of KLAY
      s.buyer.transfer(s.price);
    } else {
      // in case of KIP7
      IKIP7(s.priceContract).transfer(s.buyer, s.price);
    }

    emit EscrowRevoked(kip17Contract, tokenId, msg.sender);
    
    delete _settlements[kip17Contract][tokenId];
  }

  function closeEscrow(address kip17Contract, uint256 tokenId) public {
    Escrow storage s = _settlements[kip17Contract][tokenId];
    require(isOperator(msg.sender) || msg.sender == s.seller || msg.sender == s.buyer, "KIP17Escrow: not allowed");
    require(now >= s.expirationTime, "KIP17Escrow: not expired yet");

    if(s.priceContract == address(0)) {
      _distributeKLAY(s);
    } else {
      _distributeKIP7(s);
    }

    emit EscrowClosed(kip17Contract, tokenId, msg.sender);

    delete _settlements[kip17Contract][tokenId];
  }

  function onKIP7Received(address operator, address payable from, uint256 amount, bytes memory data) public returns (bytes4) {
    return _KIP7_RECEIVED;
  }

  function onERC721Received(address operator, address from, uint256 tokenId, bytes memory data)
      public returns (bytes4) {
    return _KIP17_RECEIVED;
  }

  function() external payable { }

  function _distributeKLAY(Escrow storage s) internal {
    uint256 remaining = s.price;

    for(uint256 i = 0; i < s.feeReceivers.length; i++) {
      s.feeReceivers[i].transfer(s.fees[i]);
      remaining -= s.fees[i];
    }
    s.seller.transfer(remaining);
  }

  function _distributeKIP7(Escrow storage s) internal {
    uint256 remaining = s.price;

    for(uint256 i = 0; i < s.feeReceivers.length; i++) {
      IKIP7(s.priceContract).transfer(s.feeReceivers[i], s.fees[i]);
      remaining -= s.fees[i];
    }
    IKIP7(s.priceContract).transfer(s.seller, remaining);
  }
}