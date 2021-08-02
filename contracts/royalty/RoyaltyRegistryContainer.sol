pragma solidity ^0.5.0;

import "./IRoyaltyRegistry.sol";
import "../access/roles/OperatorRole.sol";

contract RoyaltyRegistryContainer is OperatorRole {
  address private _royaltyRegistry;

  function setRegistry(address registry) onlyOperator public {
    _royaltyRegistry = registry;
  }

  function getRegistry() public view returns (address) {
    return _royaltyRegistry;
  }
}