pragma solidity ^0.5.0;

import "../../access/roles/OperatorRole.sol";
import "../../token/KIP17/IKIP17.sol";
import "../../token/KIP7/IKIP7.sol";

contract IKIP17Escrow {

  event EscrowOpened(address indexed kip17Contract, uint256 indexed tokenId, address seller,
    address priceContract, uint256 price, address buyer, address payable[] feeReceivers, uint256[] fees, uint256 expirationTime);
  event EscrowRevoked(address indexed kip17Contract, uint256 indexed tokenId, address operator);
  event EscrowClosed(address indexed kip17Contract, uint256 indexed tokenId, address operator);

  function openEscrow(address kip17Contract, uint256 tokenId, address payable seller, address priceContract,
      uint256 price, address payable buyer, address payable[] memory feeReceivers, uint256[] memory fees, uint256 expirationTime) public payable;

  function getEscrow(address kip17Contract, uint256 tokenId) public view 
      returns (address payable seller, address priceContract, uint256 price, address payable buyer,
      address payable[] memory feeReceivers, uint256[] memory fees, uint256 expirationTime);

  function revokeEscrow(address kip17Contract, uint256 tokenId) public;

  function closeEscrow(address kip17Contract, uint256 tokenId) public;

}