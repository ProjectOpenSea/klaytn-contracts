pragma solidity ^0.5.0;

import "./KIP37.sol";
import "./KIP37Burnable.sol";
import "./KIP37Pausable.sol";
import "./KIP37Mintable.sol";
import "../../ownership/Ownable.sol";

contract KIP37TokenOwnable is KIP37, KIP37Burnable, KIP37Pausable, KIP37Mintable, Ownable {
    constructor(string memory uri, address payable newOwner) public KIP37(uri) {
        transferOwnership(newOwner);
    }
}
