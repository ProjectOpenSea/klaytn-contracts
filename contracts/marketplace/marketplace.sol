pragma solidity ^0.5.0;

import "../math/SafeMath.sol";
import "../ownership/Ownable.sol";
import "../token/KIP17/IKIP17.sol";
import "../utils/Address.sol";


contract KIP17Marketplace is Ownable {
  using SafeMath for uint256;
  using Address for address;

  struct SellInfo {
    uint256 value;
    address payable seller;
  }

  uint256 private _feeRatio = 0;

  mapping(address => mapping (uint256 => SellInfo)) private _sells;

  /**
   * @dev Make an sell order.
   */
  function sell(address nftContract, uint256 tokenId, uint256 value) public {
    IKIP17(nftContract).transferFrom(msg.sender, address(this), tokenId);
    _sells[nftContract][tokenId] = SellInfo(value, msg.sender);
  }

  function getSellInfo(address nftContract, uint256 tokenId) public view returns (address, uint256) {
    SellInfo memory si = _sells[nftContract][tokenId];
    return (si.seller, si.value);
  }

  /**
   * @dev Revoke the sell order
   */
  function revokeSell(address nftContract, uint256 tokenId) public {
    require(_sells[nftContract][tokenId].seller == msg.sender, "Not the seller");
    IKIP17(nftContract).transferFrom(address(this), msg.sender, tokenId);
    delete _sells[nftContract][tokenId];
  }

  /**
   * @dev Buy the sell order.
   */
  function buy(address nftContract, uint256 tokenId) public payable {
    SellInfo memory si = _sells[nftContract][tokenId];
    require(si.value == msg.value, "value not matched");
    uint256 fee = si.value * _feeRatio / 100;
    si.seller.call.value(msg.value - fee)("");
    owner().call.value(fee)("");
    IKIP17(nftContract).transferFrom(address(this), msg.sender, tokenId);
    delete _sells[nftContract][tokenId];
  }

  // Admin functions
  function feeRatio() public view returns (uint256) {
    return _feeRatio;
  }

  function setFeeRatio(uint256 newFeeRatio) public onlyOwner {
    require(newFeeRatio < 100, "fee ratio cannot be over 99");
    _feeRatio = newFeeRatio;
  }
}