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

contract KIP17FixedPriceExchange is OperatorRole, RoyaltyRouterContainer, KIP17EscrowContainer, ExpirationPeriod {
  using SafeMath for uint256;

  event SalePlaced(address indexed kip17Contract, uint256 indexed tokenId, address seller, address priceContract, uint256 price);
  event SaleMatched(address indexed kip17Contract, uint256 indexed tokenId, address seller, address priceContract, uint256 price, address buyer);
  event SaleCancelled(address indexed kip17Contract, uint256 indexed tokenId, address operator);

  struct Sale {
    address payable seller;
    address priceContract;
    uint256 price;
  }

  bytes4 private constant _KIP7_RECEIVED = 0x9d188c22;
  bytes4 private constant _INTERFACE_ID_KIP7 = 0x65787371;

  mapping (address=>mapping(uint256=>Sale)) private _sales;

  function putOnSale(address kip17Contract, uint256 tokenId, address priceContract, uint256 price) public {
    address operator = msg.sender;
    address payable owner = address(uint160(IKIP17(kip17Contract).ownerOf(tokenId)));
    require(owner == operator ||
      IKIP17(kip17Contract).getApproved(tokenId) == operator ||
      IKIP17(kip17Contract).isApprovedForAll(owner, operator)
      , "KIP17FixedPriceExchange: not owner or approver");
    require(priceContract == address(0) || IKIP7(priceContract).supportsInterface(_INTERFACE_ID_KIP7), "KIP17FixedPriceExchange: not KLAY nor KIP7");
    require(IKIP17(kip17Contract).getApproved(tokenId) == address(this) ||
      IKIP17(kip17Contract).isApprovedForAll(owner, address(this)), "KIP17FixedPriceExchange: this exchange should be approved first");
    _sales[kip17Contract][tokenId] = Sale(owner, priceContract, price);

    emit SalePlaced(kip17Contract, tokenId, owner, priceContract, price);
  }

  function getSaleInfo(address kip17Contract, uint256 tokenId) public view 
      returns (address payable seller, address priceContract, uint256 price) {
    Sale storage sale = _sales[kip17Contract][tokenId];
    return (sale.seller, sale.priceContract, sale.price);
  }

  function cancelSale(address kip17Contract, uint256 tokenId) public {
    Sale storage sale = _sales[kip17Contract][tokenId];
    address operator = msg.sender;

    require(isOperator(operator) || sale.seller == operator, "KIP17FixedPriceExchange: not seller nor operator");

    emit SaleCancelled(kip17Contract, tokenId, operator);
    delete _sales[kip17Contract][tokenId];
  }

  function buyInKLAY(address kip17Contract, uint256 tokenId) public payable {
    Sale storage sale = _sales[kip17Contract][tokenId];
    require(sale.priceContract == address(0), "KIP17FixedPriceExchange: priceContract is not indicates KLAY(0)");
    require(sale.price == msg.value, "KIP17FixedPriceExchange: price not matched");

    address payable buyer = msg.sender;

    emit SaleMatched(kip17Contract, tokenId, sale.seller, sale.priceContract, sale.price, buyer);

    (address payable[] memory feeReceivers, uint256[] memory fees) = IRoyaltyRouter(getRouter()).getRoyalty(kip17Contract, tokenId, sale.price);
    uint256 expirationTime = now + getExpirationPeriod();

    IKIP17Escrow(getEscrowContract()).openEscrow.value(msg.value)(kip17Contract, tokenId, sale.seller, 
    sale.priceContract, sale.price, buyer, feeReceivers, fees, expirationTime);
    IKIP17(kip17Contract).transferFrom(sale.seller, buyer, tokenId);

    delete _sales[kip17Contract][tokenId];
  }

  function onKIP7Received(address operator, address payable from, uint256 amount, bytes memory data) public returns (bytes4) {
    (address kip17Contract, uint256 tokenId) = abi.decode(data, (address, uint256));
    Sale storage sale = _sales[kip17Contract][tokenId];
    address priceContract = msg.sender;

    require(sale.priceContract == priceContract, "KIP17FixedPriceExchange: priceContract not matched");
    require(sale.price == amount, "KIP17FixedPriceExchange: price not matched");

    address payable buyer = from;

    emit SaleMatched(kip17Contract, tokenId, sale.seller, sale.priceContract, sale.price, buyer);

    (address payable[] memory feeReceivers, uint256[] memory fees) = IRoyaltyRouter(getRouter()).getRoyalty(kip17Contract, tokenId, sale.price);
    uint256 expirationTime = now + getExpirationPeriod();

    address settlement = getEscrowContract();

    IKIP17Escrow(settlement).openEscrow(kip17Contract, tokenId, sale.seller, 
    sale.priceContract, sale.price, buyer, feeReceivers, fees, expirationTime);
    IKIP7(sale.priceContract).safeTransfer(settlement, sale.price);
    IKIP17(kip17Contract).transferFrom(sale.seller, buyer, tokenId);

    delete _sales[kip17Contract][tokenId];

    return _KIP7_RECEIVED;
  }

}