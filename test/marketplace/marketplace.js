const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const shouldFail = require('../helpers/shouldFail');
const Caver = require('caver-js');
const { ZERO_ADDRESS } = constants;

const caver = new Caver();
const KIP17Contract = artifacts.require('KIP17TokenTradable');
const FTContract = artifacts.require('KIP7Token');

const uri = "https://test.uri"
const tokenId = new BN(1)
const secondTokenId = new BN(2)
const feeRatio1 = new BN(1000)
const feeRatio2 = new BN(2000)
const price = new BN(100)
const closingPeriod = 10
const bidPrice1 = new BN(200)
const bidPrice2 = new BN(300)
const bidPrice3 = new BN(400)
const transferrable = false
const ftInitialSupply = new BN(10000000)
const BN0 = new BN(0)
const basePointDenom = new BN(100000)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

contract('KIP17Exchange', function ([minter, account1, account2, account3, feeReceiver1, feeReceiver2, otherAccounts]) {
  beforeEach(async function() {
    this.kip17Contract = await KIP17Contract.new('nft name', 'NFT', {from:minter})
    this.ftContract = await FTContract.new('ft name', 'FT', 18, ftInitialSupply, {from:minter})
    this.ftContract2 = await FTContract.new('ft2 name', 'FT2', 18, ftInitialSupply, {from:minter})
    await this.ftContract.mint(account1, ftInitialSupply, {from:minter})
    await this.ftContract.mint(account2, ftInitialSupply, {from:minter})
    await this.ftContract.mint(account3, ftInitialSupply, {from:minter})
  })
  
  it('check balance', async function() {
    const ownerBalance = await this.ftContract.balanceOf(minter)
    const account1Balance = await this.ftContract.balanceOf(account1)
    const account2Balance = await this.ftContract.balanceOf(account2)
    const account3Balance = await this.ftContract.balanceOf(account3)

    ownerBalance.should.be.bignumber.equal(ftInitialSupply)
    account1Balance.should.be.bignumber.equal(ftInitialSupply)
    account2Balance.should.be.bignumber.equal(ftInitialSupply)
    account3Balance.should.be.bignumber.equal(ftInitialSupply)
  })

  it('unauthorized mint', async function() {
    await shouldFail.reverting.withMessage(
      this.kip17Contract.mintTradable(account1, tokenId, uri, transferrable, [feeReceiver1, feeReceiver2], [feeRatio1, feeRatio2], {from:account1}),
      'MinterRole: caller does not have the Minter role'
    )
  })

  describe('mint tradable nft', async function() {
    let logs = null
    beforeEach(async function() {
      const result = await this.kip17Contract.mintTradable(account1, tokenId, uri, 
        transferrable, [feeReceiver1, feeReceiver2], [feeRatio1, feeRatio2], {from:minter})
      logs = result.logs;
    })

    it('check logs', async function() {
      expectEvent.inLogs(logs, 'TradeFeeRegistered', {
        id: tokenId,
        feeReceiver: feeReceiver1,
        feeRatioInBp: feeRatio1,
      })
      expectEvent.inLogs(logs, 'TradeFeeRegistered', {
        id: tokenId,
        feeReceiver: feeReceiver2,
        feeRatioInBp: feeRatio2,
      })
    })

    it('check trade fee', async function() {
      const result = await this.kip17Contract.tradeFee(tokenId)
      result[0][0].should.equal(feeReceiver1)
      result[0][1].should.equal(feeReceiver2)
      result[1][0].should.be.bignumber.equal(feeRatio1)
      result[1][1].should.be.bignumber.equal(feeRatio2)
    })

    it('check unauthorized place', async function() {
      await shouldFail.reverting.withMessage(
        this.kip17Contract.placeSellOrder(tokenId, this.ftContract.address, price, {from:feeReceiver1}),
        'KIP17Exchange: not owner or approver')
    })

    it('check transferFrom', async function() {
      if(transferrable === false) {
        await shouldFail.reverting.withMessage(
          this.kip17Contract.transferFrom(account1, account2, tokenId, {from:account1}),
          'KIP17Transferrable: transfer not allowed'
        )
      }
    })
    it('check safeTransferFrom', async function() {
      if(transferrable === false) {
        await shouldFail.reverting.withMessage(
          this.kip17Contract.safeTransferFrom(account1, account2, tokenId, {from:account1}),
          'KIP17Transferrable: transfer not allowed'
        )
      }
    })
    it('check safeTransferFrom with data', async function() {
      if(transferrable === false) {
        await shouldFail.reverting.withMessage(
          this.kip17Contract.methods["safeTransferFrom(address,address,uint256,bytes)"](account1, account2, tokenId, '0x', {from:account1}),
          'KIP17Transferrable: transfer not allowed'
        )
      }
    })

    describe('place sell order', async function() {
      let logs = null;
      beforeEach(async function() {
        const result = await this.kip17Contract.placeSellOrder(tokenId, this.ftContract.address, price, {from:account1})
        logs = result.logs
      })

      it('check log', async function() {
        expectEvent.inLogs(logs, 'SellOrderPlaced', {
          seller:account1,
          tokenId: tokenId,
          priceContract: this.ftContract.address,
          price:price
        })
      })

      it('check sell order', async function() {
        const result = await this.kip17Contract.getSellOrder(tokenId)
        result[0].should.equal(account1)
        result[1].should.equal(this.ftContract.address)
        result[2].should.be.bignumber.equal(price)
      })

      it('place sell order again', async function() {
        await shouldFail.reverting.withMessage(
          this.kip17Contract.placeSellOrder(tokenId, this.ftContract.address, price, {from:account1}),
          'KIP17Exchange: order already placed')
      })

      it('place auction order', async function() {
        await shouldFail.reverting.withMessage(
          this.kip17Contract.placeAuction(tokenId, this.ftContract.address, price, closingPeriod, {from:account1}),
          'KIP17Exchange: order already placed')
      })

      describe('wrong buy order', async function() {
        it('wrong tokenId', async function() {
          var data = caver.abi.encodeParameters(['uint256'], [secondTokenId])
          await shouldFail.reverting.withMessage(
            this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price, data, {from: minter}),
            'KIP17Exchange: order not found')
        })
        it('wrong price contract address', async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          await shouldFail.reverting.withMessage(
            this.ftContract2.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price, data, {from: minter}),
            'KIP17Exchange: wrong price contract address')
        })
        it('wrong price', async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          await shouldFail.reverting.withMessage(
            this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price.sub(new BN(1)), data, {from: minter}),
            'KIP17Exchange: wrong price')
        })
        it('buy with insuffcient balance', async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          await shouldFail.reverting.withMessage(
            this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price, data, {from: feeReceiver1}),
            'SafeMath: subtraction overflow')
        })
        it('finalize auction', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.finalizeAuction(tokenId),
            'KIP17Exchange: not the auction type'
          )
        })
      })

      describe('wrong cancel order', async function() {
        it('invalid tokenId', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.cancelSellOrder(secondTokenId, {from:account1}),
            'KIP17Exchange: order not found'
          )
        })
        it('invalid seller', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.cancelSellOrder(tokenId, {from:account2}),
            'KIP17Exchange: not the seller'
          )
        })
        it('cancel auction for sell order', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.cancelAuction(tokenId, {from:account1}),
            'KIP17Exchange: not the auction type'
          )
        })
      })

      describe('cancel order', async function() {
        let logs = null
        beforeEach(async function() {
          const result = await this.kip17Contract.cancelSellOrder(tokenId, {from:account1})
          logs = result.logs
        })

        it('check log', async function() {
          expectEvent.inLogs(logs, 'SellOrderCancelled', {
            tokenId
          })
        })

        it('check sell order cleared', async function() {
          const result = await this.kip17Contract.getSellOrder(tokenId)
          result[0].should.equal(ZERO_ADDRESS)
          result[1].should.equal(ZERO_ADDRESS)
          result[2].should.be.bignumber.equal(BN0)
        })
      })

      describe('buy the order', async function() {
        let logs = null
        let rawLogs = null
        var fee1 = price.mul(feeRatio1).div(basePointDenom)
        var fee2 = price.mul(feeRatio2).div(basePointDenom)
        var remaining = price.sub(fee1).sub(fee2)
        beforeEach(async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          const result = await this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price, data, {from: account2})
          logs = result.logs
          rawLogs = result.receipt.rawLogs 
        })

        it('check log', async function() {
          var topic = caver.utils.keccak256("SellOrderFinalized(address,address,uint256,address,uint256)")
          var logFound = false
          rawLogs.forEach(l=> {
            if(l.topics[0] === topic) {
              logFound = true;
              caver.abi.decodeParameters(['address'],l.topics[1])[0].should.equal(account1)
              caver.abi.decodeParameters(['address'],l.topics[2])[0].should.equal(account2)
              new BN(caver.abi.decodeParameters(['uint256'],l.topics[3])[0]).should.be.bignumber.equal(tokenId)
              
              var decoded = caver.abi.decodeParameters(['address','uint256'],l.data)
              decoded[0].should.equal(this.ftContract.address)
              new BN(decoded[1]).should.be.bignumber.equal(price)
            }
          })
          logFound.should.equal(true)
        })

        it('check balance of buyer', async function() {
          (await this.ftContract.balanceOf(account2)).should.be.bignumber.equal(ftInitialSupply.sub(price))
        })
        it('check balance of feeReceiver1', async function() {
          (await this.ftContract.balanceOf(feeReceiver1)).should.be.bignumber.equal(fee1)
        })
        it('check balance of feeReceiver2', async function() {
          (await this.ftContract.balanceOf(feeReceiver2)).should.be.bignumber.equal(fee2)
        })
        it('check balance of seller', async function() {
          (await this.ftContract.balanceOf(account1)).should.be.bignumber.equal(ftInitialSupply.add(remaining))
        })
        it('check nft ownership', async function() {
          (await this.kip17Contract.ownerOf(tokenId)).should.equal(account2)
        })
        it('check sell order cleared', async function() {
          const result = await this.kip17Contract.getSellOrder(tokenId)
          result[0].should.equal(ZERO_ADDRESS)
          result[1].should.equal(ZERO_ADDRESS)
          result[2].should.be.bignumber.equal(BN0)
        })

        it('place auction with wrong owner', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.placeAuction(tokenId, this.ftContract.address, price, closingPeriod, {from:account1}),
            'KIP17Exchange: not owner or approver'
          )
        })
      })
    })
    describe('place auction', async function() {
      let logs = null
      beforeEach(async function() {
        const result = await this.kip17Contract.placeAuction(tokenId, this.ftContract.address, price, closingPeriod, {from:account1})
        logs = result.logs
      })

      it('check log', async function() {
        expectEvent.inLogs(logs, 'AuctionPlaced', {
          seller:account1,
          tokenId,
          priceContract: this.ftContract.address,
          closingPeriod: new BN(closingPeriod),
          initialPrice:price
        })
      })
      it('check auction', async function() {
        const result = await this.kip17Contract.getAuction(tokenId)
        result.seller.should.equal(account1)
        result.bidder.should.equal(ZERO_ADDRESS)
        result.bidTimestamp.should.be.bignumber.equal(BN0)
        result.priceContract.should.equal(this.ftContract.address)
        result.currentPrice.should.be.bignumber.equal(price)
        result.closingPeriod.should.be.bignumber.equal(new BN(closingPeriod))
      })

      describe('wrong bid auction', async function() {
        it('bid auction with insufficient funds', async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          await shouldFail.reverting.withMessage(
            this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price, data, {from: feeReceiver1}),
            'SafeMath: subtraction overflow')
        })
        it('bid auction with lower or equal price', async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          await shouldFail.reverting.withMessage(
            this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, price, data, {from: account3}),
            'KIP17Exchange: bidding lower price')
        })
      })

      it('wrong finalization', async function() {
        await shouldFail.reverting.withMessage(
          this.kip17Contract.finalizeAuction(tokenId, {from:account1}),
          'KIP17Exchange: cannot finalize because of no bidder'
        )
      })

      describe('wrong cancel auction', async function() {
        it('invalid order', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.cancelAuction(secondTokenId, {from:account1}),
            'KIP17Exchange: order not found'
          )
        })
        it('invalid seller', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.cancelAuction(tokenId, {from:account2}),
            'KIP17Exchange: not the seller'
          )
        })
        it('try to cancel sell order instead of auction', async function() {
          await shouldFail.reverting.withMessage(
            this.kip17Contract.cancelSellOrder(tokenId, {from:account1}),
            'KIP17Exchange: not the sell order type'
          )
        })
      })

      describe('cancel auction with no bidder', async function() {
        let logs = null
        beforeEach(async function() {
          const result = await this.kip17Contract.cancelAuction(tokenId, {from:account1})
          logs = result.logs
        })

        it('check logs', async function() {
          expectEvent.inLogs(logs, 'AuctionCancelled', {
            tokenId
          })
        })

        it('check auction cleared', async function () {
          const result = await this.kip17Contract.getAuction(tokenId)
          result.seller.should.equal(ZERO_ADDRESS)
          result.bidder.should.equal(ZERO_ADDRESS)
          result.bidTimestamp.should.be.bignumber.equal(BN0)
          result.priceContract.should.equal(ZERO_ADDRESS)
          result.currentPrice.should.be.bignumber.equal(BN0)
          result.closingPeriod.should.be.bignumber.equal(BN0)
        })
      })

      describe('bid auction', async function() {
        let logs = null
        let rawLogs = null
        var account2Balance = null
        var account3Balance = null
        beforeEach(async function() {
          var data = caver.abi.encodeParameters(['uint256'],[tokenId])
          account2Balance = await this.ftContract.balanceOf(account2)
          account3Balance = await this.ftContract.balanceOf(account3)
          const result = await this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, bidPrice1, data, { from: account2 })
          logs = result.logs
          rawLogs = result.receipt.rawLogs 
        })

        it('check log', async function() {
          var topic = caver.utils.keccak256("AuctionBid(uint256,address,uint256)")
          var logFound = false
          rawLogs.forEach(l=> {
            if(l.topics[0] === topic) {
              logFound = true;
              new BN(caver.abi.decodeParameters(['uint256'],l.topics[1])[0]).should.be.bignumber.equal(tokenId)
              caver.abi.decodeParameters(['address'],l.topics[2])[0].should.equal(account2)
              
              var decoded = caver.abi.decodeParameters(['uint256'],l.data)
              new BN(decoded[0]).should.be.bignumber.equal(bidPrice1)
            }
          })
          logFound.should.equal(true)
        })

        it('check auction values', async function() {
          const result = await this.kip17Contract.getAuction(tokenId)
          result.seller.should.equal(account1)
          result.bidder.should.equal(account2)
          result.bidTimestamp.should.be.bignumber.not.equal(BN0)
          result.priceContract.should.equal(this.ftContract.address)
          result.currentPrice.should.be.bignumber.equal(bidPrice1)
        })

        it('check balance', async function() {
          const b = await this.ftContract.balanceOf(account2)
          b.should.be.bignumber.equal(account2Balance.sub(bidPrice1))
        })

        describe('cancel auction with a bidder', async function() {
          let logs = null
          beforeEach(async function() {
            const result = await this.kip17Contract.cancelAuction(tokenId, {from:account1})
            logs = result.logs
          })

          it('check logs', async function() {
            expectEvent.inLogs(logs, 'AuctionCancelled', {
              tokenId
            })
          })

          it('check balance of the bidder', async function() {
            const b = await this.ftContract.balanceOf(account2)
            b.should.be.bignumber.equal(account2Balance)
          })

          it('check auction cleared', async function () {
            const result = await this.kip17Contract.getAuction(tokenId)
            result.seller.should.equal(ZERO_ADDRESS)
            result.bidder.should.equal(ZERO_ADDRESS)
            result.bidTimestamp.should.be.bignumber.equal(BN0)
            result.priceContract.should.equal(ZERO_ADDRESS)
            result.currentPrice.should.be.bignumber.equal(BN0)
            result.closingPeriod.should.be.bignumber.equal(BN0)
          })
        })

        describe('bid auction again with the same account', async function() {
          let logs = null
          let rawLogs = null
          beforeEach(async function() {
            var data = caver.abi.encodeParameters(['uint256'],[tokenId])
            const result = await this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, bidPrice2, data, { from: account2 })
            logs = result.logs
            rawLogs = result.receipt.rawLogs 
          })

          it('check log', async function() {
            var topic = caver.utils.keccak256("AuctionBid(uint256,address,uint256)")
            var logFound = false
            rawLogs.forEach(l=> {
              if(l.topics[0] === topic) {
                logFound = true;
                new BN(caver.abi.decodeParameters(['uint256'],l.topics[1])[0]).should.be.bignumber.equal(tokenId)
                caver.abi.decodeParameters(['address'],l.topics[2])[0].should.equal(account2)
                
                var decoded = caver.abi.decodeParameters(['uint256'],l.data)
                new BN(decoded[0]).should.be.bignumber.equal(bidPrice2)
              }
            })
            logFound.should.equal(true)
          })

          it('check auction values', async function() {
            const result = await this.kip17Contract.getAuction(tokenId)
            result.seller.should.equal(account1)
            result.bidder.should.equal(account2)
            result.bidTimestamp.should.be.bignumber.not.equal(BN0)
            result.priceContract.should.equal(this.ftContract.address)
            result.currentPrice.should.be.bignumber.equal(bidPrice2)

          })
          it('check balance', async function() {
            const b = await this.ftContract.balanceOf(account2)
            b.should.be.bignumber.equal(account2Balance.sub(bidPrice2))
          })
        })

        describe('bid auction again with the another account', async function() {
          let logs = null
          let rawLogs = null
          beforeEach(async function() {
            var data = caver.abi.encodeParameters(['uint256'],[tokenId])
            const result = await this.ftContract.methods['safeTransfer(address,uint256,bytes)'](this.kip17Contract.address, bidPrice3, data, { from: account3 })
            logs = result.logs
            rawLogs = result.receipt.rawLogs 
          })

          it('check log', async function() {
            var topic = caver.utils.keccak256("AuctionBid(uint256,address,uint256)")
            var logFound = false
            rawLogs.forEach(l=> {
              if(l.topics[0] === topic) {
                logFound = true;
                new BN(caver.abi.decodeParameters(['uint256'],l.topics[1])[0]).should.be.bignumber.equal(tokenId)
                caver.abi.decodeParameters(['address'],l.topics[2])[0].should.equal(account3)
                
                var decoded = caver.abi.decodeParameters(['uint256'],l.data)
                new BN(decoded[0]).should.be.bignumber.equal(bidPrice3)
              }
            })
            logFound.should.equal(true)
          })

          it('check auction values', async function() {
            const result = await this.kip17Contract.getAuction(tokenId)
            result.seller.should.equal(account1)
            result.bidder.should.equal(account3)
            result.bidTimestamp.should.be.bignumber.not.equal(BN0)
            result.priceContract.should.equal(this.ftContract.address)
            result.currentPrice.should.be.bignumber.equal(bidPrice3)

          })
          it('check balance of the current bidder', async function() {
            const b = await this.ftContract.balanceOf(account3)
            b.should.be.bignumber.equal(account3Balance.sub(bidPrice3))
          })
          it('check balance of the previous bidder', async function() {
            const b = await this.ftContract.balanceOf(account2)
            b.should.be.bignumber.equal(account2Balance)
          })

          describe('wrong finalize auction', async function() {
            it('invalid order', async function() {
              await shouldFail.reverting.withMessage(
                this.kip17Contract.finalizeAuction(secondTokenId),
                'KIP17Exchange: order not found')
            })
            it('unauthorized finalization', async function() {
              await shouldFail.reverting.withMessage(
                this.kip17Contract.finalizeAuction(tokenId, {from:account3}),
                'KIP17Exchange: not the seller or minter')
            })
            it('closing period not passed', async function() {
              await shouldFail.reverting.withMessage(
                this.kip17Contract.finalizeAuction(tokenId, {from:minter}),
                'KIP17Exchange: closing period not passed')
            })
          })

          describe('close auction', async function() {
            let logs = null
            var account1Balance = null
            var account2Balance = null
            var account3Balance = null
            var feeReceiver1Balance = null
            var feeReceiver2Balance = null
            var fee1 = bidPrice3.mul(feeRatio1).div(basePointDenom)
            var fee2 = bidPrice3.mul(feeRatio2).div(basePointDenom)
            var remaining = bidPrice3.sub(fee1).sub(fee2)
            beforeEach(async function() {
              account1Balance = await this.ftContract.balanceOf(account1)
              account2Balance = await this.ftContract.balanceOf(account2)
              account3Balance = await this.ftContract.balanceOf(account3)
              feeReceiver1Balance = await this.ftContract.balanceOf(feeReceiver1)
              feeReceiver2Balance = await this.ftContract.balanceOf(feeReceiver2)
              await sleep((closingPeriod+1)*1000)
              const result = await this.kip17Contract.finalizeAuction(tokenId, {from:account1})
              logs = result.logs
            })

            it('check log', async function() {
              expectEvent.inLogs(logs, 'AuctionFinalized', {
                seller: account1,
                buyer: account3,
                tokenId,
                priceContract: this.ftContract.address,
                price: bidPrice3
              })
            })

            it('check balance of buyer', async function() {
              (await this.ftContract.balanceOf(account3)).should.be.bignumber.equal(account3Balance)
            })
            it('check balance of feeReceiver1', async function() {
              (await this.ftContract.balanceOf(feeReceiver1)).should.be.bignumber.equal(feeReceiver1Balance.add(fee1))
            })
            it('check balance of feeReceiver2', async function() {
              (await this.ftContract.balanceOf(feeReceiver2)).should.be.bignumber.equal(feeReceiver2Balance.add(fee2))
            })
            it('check balance of seller', async function() {
              (await this.ftContract.balanceOf(account1)).should.be.bignumber.equal(account1Balance.add(remaining))
            })
            it('check nft ownership', async function() {
              (await this.kip17Contract.ownerOf(tokenId)).should.equal(account3)
            })
            it('check auction cleared', async function() {
              const result = await this.kip17Contract.getAuction(tokenId)
              result.seller.should.equal(ZERO_ADDRESS)
              result.bidder.should.equal(ZERO_ADDRESS)
              result.bidTimestamp.should.be.bignumber.equal(BN0)
              result.priceContract.should.equal(ZERO_ADDRESS)
              result.currentPrice.should.be.bignumber.equal(BN0)
              result.closingPeriod.should.be.bignumber.equal(BN0)
            })
          })
        })
      })
    })
  })
})