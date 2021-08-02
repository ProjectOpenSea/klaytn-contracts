pragma solidity ^0.5.0;

import "../../math/SafeMath.sol";
import "../../access/roles/OperatorRole.sol";
import "../../token/KIP17/IKIP17.sol";
import "../../token/KIP7/IKIP7.sol";
import "../../royalty/RoyaltyRouterContainer.sol";
import "../../royalty/IRoyaltyRouter.sol";
import "../../exchange/KIP17/IKIP17Escrow.sol";
import "../../exchange/KIP17/KIP17EscrowContainer.sol";
import "../ExpirationPeriod.sol";

contract KIP17Auction is OperatorRole, RoyaltyRouterContainer, KIP17EscrowContainer, ExpirationPeriod {
  using SafeMath for uint256;

  event AuctionPlaced(address indexed kip17Contract, uint256 indexed tokenId, address seller, address priceContract, uint256 initialPrice);
  event AuctionCancelled(address indexed kip17Contract, uint256 indexed tokenId, address operator);
  event AuctionBid(address indexed kip17Contract, uint256 indexed tokenId, address bidder, uint256 bidPrice);
  event AuctionFinalized(address indexed kip17Contract, uint256 indexed tokenId, address seller, address priceContract, uint256 price, address buyer);

  struct Auction {
    address payable seller;
    address priceContract;
    uint256 initialPrice;
    address payable bidder;
    uint256 bidPrice;
  }

  bytes4 private constant _KIP7_RECEIVED = 0x9d188c22;
  bytes4 private constant _INTERFACE_ID_KIP7 = 0x65787371;

  mapping(address=>mapping(uint256=>Auction)) private _auctions;

  function placeAuction(address kip17Contract, uint256 tokenId, address priceContract, uint256 initialPrice) public {
    address payable operator = msg.sender;
    address payable owner = address(uint160(IKIP17(kip17Contract).ownerOf(tokenId)));
    require(owner == operator ||
      IKIP17(kip17Contract).getApproved(tokenId) == operator ||
      IKIP17(kip17Contract).isApprovedForAll(owner, operator)
      , "KIP17Auction: not owner");
    require(priceContract == address(0) || IKIP7(priceContract).supportsInterface(_INTERFACE_ID_KIP7), "KIP17Auction: not KLAY nor KIP7");
    require(IKIP17(kip17Contract).getApproved(tokenId) == address(this) ||
      IKIP17(kip17Contract).isApprovedForAll(owner, address(this)), "KIP17Auction: this exchange should be approved first");
    _auctions[kip17Contract][tokenId] = Auction(owner, priceContract, initialPrice, address(0), 0);

    emit AuctionPlaced(kip17Contract, tokenId, owner, priceContract, initialPrice);
  }

  function getAuction(address kip17Contract, uint256 tokenId) public view 
      returns (address payable seller, address priceContract, uint256 initialPrice, address payable bidder, uint256 bidPrice) {
    Auction storage auction = _auctions[kip17Contract][tokenId];
    return (auction.seller, auction.priceContract, auction.initialPrice, auction.bidder, auction.bidPrice);
  }

  function cancelAuction(address kip17Contract, uint256 tokenId) public {
    Auction storage auction = _auctions[kip17Contract][tokenId];
    address operator = msg.sender;

    require(isOperator(operator) || auction.seller == operator, "KIP17Auction: not seller nor operator");

    // if bidder exists, send the value back.
    _returnBid(auction);

    emit AuctionCancelled(kip17Contract, tokenId, operator);
    delete _auctions[kip17Contract][tokenId];
  }

  function bidKLAY(address kip17Contract, uint256 tokenId) public payable {
    Auction storage auction = _auctions[kip17Contract][tokenId];
    require(auction.priceContract == address(0), "KIP17Auction: priceContract is not indicates KLAY(0)");

    address payable bidder = msg.sender;
    uint256 bidPrice = msg.value;

    _bid(auction, kip17Contract, tokenId, bidder, bidPrice);
  }

  function onKIP7Received(address operator, address payable from, uint256 amount, bytes memory data) public returns (bytes4) {
    (address kip17Contract, uint256 tokenId) = abi.decode(data, (address, uint256));
    Auction storage auction = _auctions[kip17Contract][tokenId];
    address priceContract = msg.sender;

    require(auction.priceContract == priceContract, "KIP17Auction: priceContract not matched");

    address payable bidder = from;
    uint256 bidPrice = amount;

    _bid(auction, kip17Contract, tokenId, bidder, bidPrice);

    return _KIP7_RECEIVED;
  }

  function finalizeAuction(address kip17Contract, uint256 tokenId) public {
    Auction storage auction = _auctions[kip17Contract][tokenId];
    require(auction.bidder != address(0), "KIP17Auction: no bidder");
    require(isOperator(msg.sender), "KIP17Auction: not operator");

    // check the ownership of the NFT
    require(IKIP17(kip17Contract).ownerOf(tokenId) == auction.seller, "KIP17Auction: seller is not owner. please cancel the auction.");

    _settleAuction(auction, kip17Contract, tokenId);

    emit AuctionFinalized(kip17Contract, tokenId, auction.seller, auction.priceContract, auction.bidPrice, auction.bidder);

    delete _auctions[kip17Contract][tokenId];
  }

  function _settleAuction(Auction storage auction, address kip17Contract, uint256 tokenId) internal {
    address settlement = getEscrowContract();

    (address payable[] memory feeReceivers, uint256[] memory fees) = IRoyaltyRouter(getRouter()).getRoyalty(kip17Contract, tokenId, auction.bidPrice);
    uint256 expirationTime = now + getExpirationPeriod();

    if(auction.priceContract == address(0)) {
      IKIP17Escrow(settlement).openEscrow.value(msg.value)(kip17Contract, tokenId, auction.seller, 
      auction.priceContract, auction.bidPrice, auction.bidder, feeReceivers, fees, expirationTime);
      IKIP17(kip17Contract).transferFrom(auction.seller, settlement, tokenId);
    } else {
      IKIP17Escrow(settlement).openEscrow(kip17Contract, tokenId, auction.seller, 
      auction.priceContract, auction.bidPrice, auction.bidder, feeReceivers, fees, expirationTime);
      IKIP7(auction.priceContract).safeTransfer(settlement, auction.bidPrice);
      IKIP17(kip17Contract).transferFrom(auction.seller, settlement, tokenId);
    }

  }

  function _bid(Auction storage auction, address kip17Contract, uint256 tokenId, 
      address payable bidder, uint256 bidPrice) internal {
    require(auction.initialPrice <= bidPrice, "KIP17Auction: bid price is lower than initial price");
    require(auction.bidPrice < bidPrice, "KIP17Auction: lower bid price");

    // if we have previous bid, return the bid.
    _returnBid(auction);

    emit AuctionBid(kip17Contract, tokenId, bidder, bidPrice);

    _auctions[kip17Contract][tokenId].bidder = bidder;
    _auctions[kip17Contract][tokenId].bidPrice = bidPrice;
  }

  function _returnBid(Auction storage auction) internal {
    if(auction.bidder != address(0)) {
      if(auction.priceContract == address(0)) {
        auction.bidder.transfer(auction.bidPrice);
      } else {
        IKIP7(auction.priceContract).transfer(auction.bidder, auction.bidPrice);
      }
    }
  }

}