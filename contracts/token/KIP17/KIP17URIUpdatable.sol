pragma solidity ^0.5.0;

import "./KIP17MetadataMintable.sol";

contract KIP17URIUpdatable is KIP17MetadataMintable {

    mapping(uint256 => uint256) private _contentHash;

    event URIUpdated(address indexed updater, uint256 indexed tokenId, string uri);

    modifier notEmptyContentHash(uint256 tokenId) {
        require(_contentHash[tokenId] != 0, "KIP17: empty contentHash");

        _;
    }

    function updateTokenURI(uint256 tokenId, string memory uri) public 
        notEmptyContentHash(tokenId) returns (bool) {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(msg.sender, tokenId), "KIP17: transfer caller is not owner nor approved");

        _setTokenURI(tokenId, uri);
        emit URIUpdated(msg.sender, tokenId, uri);

        return true;
    }

    function mintWithTokenURIAndHash(address to, uint256 tokenId, 
            string memory uri, uint256 contentHash) 
        public onlyMinter returns (bool) {

        mintWithTokenURI(to, tokenId, uri);
        _contentHash[tokenId] = contentHash;
        return true;
    }
}