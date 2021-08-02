pragma solidity ^0.5.0;

import "./IRoyaltyRouter.sol";
import "../access/roles/OperatorRole.sol";

contract RoyaltyRouterContainer is OperatorRole {
  address private _royaltyRouter;

  function setRouter(address registry) onlyOperator public {
    _royaltyRouter = registry;
  }

  function getRouter() public view returns (address) {
    return _royaltyRouter;
  }
}