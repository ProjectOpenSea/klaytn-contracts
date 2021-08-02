pragma solidity ^0.5.0;

import "../access/roles/OperatorRole.sol";

contract ExpirationPeriod is OperatorRole {
  uint256 private _expirationPeriod;

  function setExpirationPeriod(uint256 period) public onlyOperator {
    _expirationPeriod = period;
  }

  function getExpirationPeriod() public view returns (uint256) {
    return _expirationPeriod;
  }
}