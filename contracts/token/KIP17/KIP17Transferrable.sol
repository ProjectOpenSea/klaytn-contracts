pragma solidity ^0.5.0;

import "./KIP17.sol";

contract KIP17Transferrable is KIP17 {
  mapping (uint256 => bool) private _transferrable;

  modifier onlyTransferrable(uint256 tokenId) {
    require(_transferrable[tokenId], "KIP17Transferrable: transfer not allowed");
    _;
  }

  function _setTransferrable(uint256 tokenId, bool transferrable) internal {
    _transferrable[tokenId] = transferrable;
  }

  function isTransferrable(uint256 tokenId) public view returns (bool) {
    return _transferrable[tokenId];
  }

  function transferFrom(address from, address to, uint256 tokenId) public 
    onlyTransferrable(tokenId)
  {
    super.transferFrom(from, to, tokenId);
  }

  function safeTransferFrom(address from, address to, uint256 tokenId)
      public onlyTransferrable(tokenId) {
    super.safeTransferFrom(from, to, tokenId);
  }

  function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) 
      public onlyTransferrable(tokenId) {
    super.safeTransferFrom(from, to, tokenId, _data);
  }
}
