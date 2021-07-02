pragma solidity ^0.5.0;

import "./KIP17Full.sol";
import "./KIP17URIUpdatable.sol";
import "./KIP17Mintable.sol";
import "./KIP17Burnable.sol";
import "./KIP17Pausable.sol";

contract KIP17URIUpdatableToken is KIP17Full, KIP17Mintable, KIP17URIUpdatable, KIP17Burnable, KIP17Pausable {
    constructor (string memory name, string memory symbol) public KIP17Full(name, symbol) {
    }
}