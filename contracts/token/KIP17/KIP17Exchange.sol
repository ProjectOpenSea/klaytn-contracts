pragma solidity ^0.5.0;

import "../KIP7/IKIP7.sol";
import "./KIP17Transferrable.sol";
import "./KIP17Enumerable.sol";
import "./KIP17MetadataMintable.sol";
import "./KIP17Mintable.sol";
import "../../exchange/TradeFeeRegistry.sol";

contract KIP17Exchange is KIP17Transferrable, KIP17Enumerable, KIP17Mintable, KIP17MetadataMintable, TradeFeeRegistry {
  enum OrderType { None, SellOrder, Auction }

  struct SellOrder {
    address priceContract;
    uint256 price;
  }

  struct Auction {
    address bidder;
    uint256 bidTimestamp;
    uint256 closingPeriod;
    address priceContract;
    uint256 price;
  }

  struct Order {
    address seller;
    OrderType orderType;
  }

  event SellOrderPlaced(address indexed seller, uint256 indexed tokenId, address indexed priceContract,
      uint256 price);
  event SellOrderCancelled(uint256 indexed tokenId);
  event SellOrderFinalized(address indexed seller, address indexed buyer, uint256 indexed tokenId, 
    address priceContract, uint256 price);

  event AuctionPlaced(address indexed seller, uint256 indexed tokenId, address indexed priceContract,
      uint256 closingPeriod, uint256 initialPrice);
  event AuctionBid(uint256 indexed tokenId, address indexed bidder, uint256 price);
  event AuctionCancelled(uint256 indexed tokenId);
  event AuctionFinalized(address indexed seller, address indexed buyer, uint256 indexed tokenId,
    address priceContract, uint256 price);

  // (nftContract, tokenId) => Order
  mapping(uint256 => Order) _orders;
  mapping(uint256 => SellOrder) _sellOrders;
  mapping(uint256 => Auction) _auctions;

  bytes4 private constant _KIP7_RECEIVED = 0x9d188c22;

  constructor (string memory name, string memory symbol) public KIP17Metadata(name, symbol) {
      // solhint-disable-previous-line no-empty-blocks
  }

  function mintTradable(address to, uint256 tokenId, string memory tokenURI,
      bool transferrable, address[] memory feeReceivers, uint256[] memory feeRatiosInBp) 
      public onlyMinter returns (bool) {

    mintWithTokenURI(to, tokenId, tokenURI);
    _registerTradeFeeBatch(tokenId, feeReceivers, feeRatiosInBp);
    _setTransferrable(tokenId, transferrable);

    return true;
  }

  function placeSellOrder(uint256 tokenId, address priceContract, uint256 price) public {
    require(_checkPermission(tokenId), "KIP17Exchange: not owner or approver");
    require(_orders[tokenId].seller == address(0), "KIP17Exchange: order already placed");

    address seller = msg.sender;
    _orders[tokenId] = Order(seller, OrderType.SellOrder);
    _sellOrders[tokenId] = SellOrder(priceContract, price);

    emit SellOrderPlaced(seller, tokenId, priceContract, price);
  }

  function getSellOrder(uint256 tokenId) public view 
      returns (address seller, address priceContract, uint256 price) {
    seller = _orders[tokenId].seller;
    SellOrder storage o = _sellOrders[tokenId];

    return (seller, o.priceContract, o.price);
  }

  function cancelSellOrder(uint256 tokenId) public {
    Order storage o = _orders[tokenId];
    require(o.seller != address(0), "KIP17Exchange: order not found");
    require(o.seller == msg.sender, "KIP17Exchange: not the seller");
    require(o.orderType == OrderType.SellOrder, "KIP17Exchange: not the sell order type");

    emit SellOrderCancelled(tokenId);
    _clearSellOrder(tokenId);
  }

  function placeAuction(uint256 tokenId, address priceContract, uint256 initialPrice, 
      uint256 closingPeriod) public {
    require(_checkPermission(tokenId), "KIP17Exchange: not owner or approver");
    require(_orders[tokenId].seller == address(0), "KIP17Exchange: order already placed");

    address seller = msg.sender;
    _orders[tokenId] = Order(seller, OrderType.Auction);
    _auctions[tokenId] = Auction(address(0), 0, closingPeriod, priceContract, initialPrice);

    emit AuctionPlaced(seller, tokenId, priceContract, closingPeriod, initialPrice);
  }

  function getAuction(uint256 tokenId) public view
      returns (address seller, address bidder, uint256 bidTimestamp, address priceContract, 
        uint256 currentPrice, uint256 closingPeriod) {
    seller = _orders[tokenId].seller;
    Auction storage a = _auctions[tokenId];

    return (seller, a.bidder, a.bidTimestamp, a.priceContract, a.price, a.closingPeriod);
  }

  function cancelAuction(uint256 tokenId) public {
    Order storage o = _orders[tokenId];
    require(o.seller != address(0), "KIP17Exchange: order not found");
    require(o.seller == msg.sender, "KIP17Exchange: not the seller");
    require(o.orderType == OrderType.Auction, "KIP17Exchange: not the auction type");

    Auction storage a = _auctions[tokenId];
    if(a.bidder != address(0)) {
      address bidder = a.bidder;
      a.bidder = 0;
      if(a.priceContract == address(0)) {
        bidder.transfer(a.price);
      } else {
        IKIP7(a.priceContract).transfer(bidder, a.price);
      }
    }

    emit AuctionCancelled(tokenId);
    _clearAuction(tokenId);
  }

  function finalizeAuction(uint256 tokenId) public {
    Order storage o = _orders[tokenId];
    require(o.seller != address(0), "KIP17Exchange: order not found");
    require(o.orderType == OrderType.Auction, "KIP17Exchange: not the auction type");
    require(msg.sender == o.seller || isMinter(msg.sender), "KIP17Exchange: not the seller or minter");

    Auction storage a = _auctions[tokenId];
    require(a.bidder != address(0), "KIP17Exchange: cannot finalize because of no bidder");
    require(a.bidTimestamp + a.closingPeriod < now, "KIP17Exchange: closing period not passed");

    _finalizeTrade(a.bidder, tokenId, a.priceContract, a.price);

    emit AuctionFinalized(o.seller, a.bidder, tokenId, a.priceContract, a.price);
    _clearAuction(tokenId);
  }

  function buySellOrder(uint256 tokenId, uint256 amount) public payable {
    // check order existence.
    Order storage o = _orders[tokenId];
    require(o.seller != address(0), "KIP17Exchange: order not found");
    require(o.orderType == OrderType.SellOrder, "KIP17Exchange: not the sell order type");

    _buySellOrder(msg.sender, tokenId, address(0), msg.value);
  }

  function bidAuction(uint256 tokenId, uint256 amount) public payable {
    // check order existence.
    Order storage o = _orders[tokenId];
    require(o.seller != address(0), "KIP17Exchange: order not found");
    require(o.orderType == OrderType.Auction, "KIP17Exchange: not the auction type");

    _buySellOrder(msg.sender, tokenId, address(0), msg.value);
  }

  function onKIP7Received(address _operator, address _from, uint256 _amount, 
      bytes memory _data) public returns (bytes4) {
    uint256 tokenId = abi.decode(_data, (uint256));
    // check order existence.
    Order storage o = _orders[tokenId];
    require(o.seller != address(0), "KIP17Exchange: order not found");

    address buyer = _from;
    if(o.orderType == OrderType.SellOrder) {
      _buySellOrder(buyer, tokenId, msg.sender, _amount);
    } else if(o.orderType == OrderType.Auction) {
      _bidAuction(buyer, tokenId, msg.sender, _amount);
    } else {
      revert("Undefined order type");
    }

    return _KIP7_RECEIVED;
  }

  function _finalizeTrade(address buyer, uint256 tokenId, address priceContract, uint256 price) internal {
    // Distribute trade fee
    uint256 remaining = _distributeTradeFee(tokenId, priceContract, price);
    address seller = _orders[tokenId].seller;
    if(priceContract == address(0)) {
      seller.transfer(remaining);
    } else {
      IKIP7(priceContract).transfer(seller, remaining);
    }

    // Finally, send the KIP17 token
    _transferFrom(seller, buyer, tokenId);
  }

  function _clearSellOrder(uint256 tokenId) internal {
    delete _orders[tokenId];
    delete _sellOrders[tokenId];
  }

  function _clearAuction(uint256 tokenId) internal {
    delete _auctions[tokenId];
    delete _orders[tokenId];
  }

  function _checkPermission(uint256 tokenId) internal view returns (bool) {
    address owner = ownerOf(tokenId);
    address approver = getApproved(tokenId);
    bool approvedForAll = isApprovedForAll(owner, msg.sender);

    return owner == msg.sender || approver == msg.sender || approvedForAll;
  }

  function _buySellOrder(address buyer, uint256 tokenId, address priceContract uint256 price) internal {
    SellOrder storage o = _sellOrders[tokenId];
    require(o.priceContract == priceContract, "KIP17Exchange: wrong price contract address");
    require(o.price == price, "KIP17Exchange: wrong price");

    // pass the value to the nft contract.
    _finalizeTrade(buyer, tokenId, priceContract, price);

    emit SellOrderFinalized(_orders[tokenId].seller, buyer, tokenId, priceContract, price);
    // clear the sell order
    _clearSellOrder(tokenId);
  }

  function _bidAuction(address bidder, uint256 tokenId, address priceCOntract, uint256 price) internal {
    Auction storage a = _auctions[tokenId];
    require(a.priceContract == priceContract, "KIP17Exchange: wrong price contract address");
    require(a.price < price, "KIP17Exchange: bidding lower price");

    // If the previous bidder found, payback to the bidder.
    if(a.bidder != address(0)) {
      address bidder = a.bidder;
      a.bidder = address(0);
      if(priceContract == address(0)) {
        bidder.transfer(a.price);
      } else {
        IKIP7(priceContract).transfer(bidder, a.price);
      }
    }

    a.bidder = bidder;
    a.bidTimestamp = block.timestamp;
    a.price = price;

    emit AuctionBid(tokenId, bidder, price);
  }

}