pragma solidity ^0.5.0;

import "../../access/roles/OperatorRole.sol";
import "./KIP17Escrow.sol";

contract KIP17EscrowContainer is OperatorRole {
  address payable private _settlement;

  function setEscrowContract(address payable settlement) onlyOperator public {
    _settlement = settlement;
  }

  function getEscrowContract() public view returns (address payable) {
    return _settlement;
  }
}