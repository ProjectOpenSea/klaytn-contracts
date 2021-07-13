pragma solidity ^0.5.0;

import "../token/KIP7/IKIP7.sol";
import "../math/SafeMath.sol";

contract TradeFeeRegistry {
  using SafeMath for uint256;

  mapping(uint256 => address[]) private _tradeFeeReceivers;
  mapping(uint256 => uint256[]) private _tradeFeeRatiosInBp;

  event TradeFeeRegistered(uint256 indexed id, address indexed feeReceiver, uint256 feeRatioInBp);

  constructor() public {
  }

  function _registerTradeFeeBatch(uint256 id, address[] memory feeReceivers, uint256[] memory feeRatiosInBp) internal {
    require(feeReceivers.length == feeRatiosInBp.length, "TradeFeeRegistry: the length of feeReceivers and feeRatiosInBp is not matched");
    for(uint256 i = 0; i < feeReceivers.length; i++) {
      _registerTradeFee(id, feeReceivers[i], feeRatiosInBp[i]);
    }
  }

  function _registerTradeFee(uint256 id, address feeReceiver, uint256 feeRatioInBp) internal {
    // check existence of feeReceiver
    for(uint256 i = 0; i < _tradeFeeReceivers[id].length; i++) {
      require(_tradeFeeReceivers[id][i] != feeReceiver, "TradeFeeRegistry: feeReceiver already registered");
    }
    _tradeFeeReceivers[id].push(feeReceiver);
    _tradeFeeRatiosInBp[id].push(feeRatioInBp);
    emit TradeFeeRegistered(id, feeReceiver, feeRatioInBp);
  }

  function _unregisterTradeFee(uint256 id, address feeReceiver) internal {
    for(uint256 i = 0; i < _tradeFeeReceivers[id].length; i++) {
      if( _tradeFeeReceivers[id][i] == feeReceiver) {
        if(i != _tradeFeeReceivers[id].length -1 ) {
          uint256 lastIndex = _tradeFeeReceivers[id].length-1;
          _tradeFeeReceivers[id][i] = _tradeFeeReceivers[id][lastIndex];
          _tradeFeeRatiosInBp[id][i] = _tradeFeeRatiosInBp[id][lastIndex];
          break;
        }
      }
    }
  }

  function tradeFee(uint256 id) public view returns (address[] memory, uint256[] memory) {
    return (_tradeFeeReceivers[id], _tradeFeeRatiosInBp[id]);
  }

  function _distributeTradeFee(uint256 id, address priceContract, uint256 price) internal returns (uint256) {
    uint256 remaining = price;
    for(uint256 i = 0; i < _tradeFeeReceivers[id].length; i++) {
      uint256 amount = price.mul(_tradeFeeRatiosInBp[id][i]).div(100000);
      if(priceContract == address(0)) {
        _tradeFeeReceivers[id][i].transfer(amount);
      } else {
        IKIP7(priceContract).safeTransfer(_tradeFeeReceivers[id][i], amount);
      }
      remaining -= amount;
    }
    return remaining;
  }
}