pragma solidity ^0.5.0;

import "./KIP17Burnable.sol";
import "./KIP17Pausable.sol";
import "./KIP17Exchange.sol";

contract KIP17TokenTradable is KIP17Burnable, KIP17Pausable, KIP17Exchange {

  constructor (string memory name, string memory symbol) public KIP17Full(name, symbol) {
  }

}