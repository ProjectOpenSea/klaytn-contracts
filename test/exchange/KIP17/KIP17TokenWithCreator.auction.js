
const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const expectRevert = require('../../helpers/expectRevert')
const { ZERO_ADDRESS } = constants;
const Caver = require('caver-js');

const caver = new Caver();

const _sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const KIP17TokenWithCreator = artifacts.require('KIP17TokenWithCreator');
const RoyaltyRegistry = artifacts.require('RoyaltyRegistry')
const RoyaltyRouter = artifacts.require('RoyaltyRouter')
const KIP17Auction = artifacts.require('KIP17Auction')
const KIP7Token = artifacts.require('KIP7Token')
const KIP17Settlment = artifacts.require('KIP17Settlement')

contract('KIP17TokenWithCreator with Auction', function(accounts) {
  const [operator, seller, bidder1, buyer, tokenHolderThree, approver, ...otherAccounts] = accounts;
  const initialURI = 'https://token-cdn-domain/1.json';
  const name = 'NFT contract'
  const symbol = 'NFT'
  const tokenOne = '1' 
  const tokenTwo = '2'
  const receivers = [buyer, tokenHolderThree]
  const ratiosInBp = [new BN(1000), new BN(25000)]
  const initialPrice = new BN(1000000)
  const bidPrice1 = new BN(2000000)
  const bidPrice2 = new BN(2100000)
  const basisPoint = new BN(100000)
  const expirationPeriod = new BN(10)

  beforeEach(async function () {
    this.ft = await KIP7Token.new('FT contract', 'FT', 18, new BN('1000000000000000000000000000000'))
    this.nft = await KIP17TokenWithCreator.new(name, symbol)
    this.royaltyRouter = await RoyaltyRouter.new()
    this.royaltyRegistry = await RoyaltyRegistry.new()
    this.exchange = await KIP17Auction.new()
    this.settlement = await KIP17Settlment.new()

    await this.ft.transfer(seller, new BN('100000000000'))
    await this.ft.transfer(bidder1, new BN('100000000000'))
    await this.ft.transfer(buyer, new BN('100000000000'))

    await this.nft.mintWithTokenURI(seller, tokenOne, initialURI, {from:operator})
    await this.royaltyRouter.overrideAddress(this.nft.address, this.royaltyRegistry.address)
    await this.royaltyRegistry.setRoyalty(this.nft.address, tokenOne, receivers, ratiosInBp, { from: seller})

    await this.exchange.setRouter(this.royaltyRouter.address)
    await this.exchange.setSettlementContract(this.settlement.address)
    await this.exchange.setExpirationPeriod(expirationPeriod)

    await this.settlement.addOperator(this.exchange.address)
  });

  shouldBehaveAuction('KLAY')
  shouldBehaveAuction('KIP7')

  function shouldBehaveAuction(currency) {
    var priceContract
    var getBalance
    describe(`using ${currency}`, async function () {
      beforeEach(async function() {
        if(currency === 'KLAY') {
          priceContract = ZERO_ADDRESS
          getBalance = web3.eth.getBalance
        } else {
          priceContract = this.ft.address
          getBalance = this.ft.balanceOf
        }
      })

      describe('placeAuction', async function () {
        describe('expect failure', async function () {
          it('not owner', async function () {
            await expectRevert(
              this.exchange.placeAuction(this.nft.address, tokenOne, priceContract, initialPrice),
              'KIP17Auction: not owner'
            )
          })

          it('not KLAY or KIP7 address', async function () {
            await expectRevert(
              this.exchange.placeAuction(this.nft.address, tokenOne, this.nft.address, initialPrice, { from: seller }),
              'KIP17Auction: not KLAY nor KIP7'
            )
          })

          it('not approved', async function() {
            await expectRevert(
              this.exchange.placeAuction(this.nft.address, tokenOne, priceContract, initialPrice, { from: seller }),
              'KIP17Auction: this exchange should be approved first'
            )
          })
        })

        describe('expect succeeded', async function () {
          var result = null
          beforeEach(async function () {
            await this.nft.approve(this.exchange.address, tokenOne, {from:seller})
            result = await this.exchange.placeAuction(this.nft.address, tokenOne, priceContract, initialPrice, { from: seller })
          })

          it('check logs', async function () {
            expectEvent.inLogs(result.logs, 'AuctionPlaced', {
              kip17Contract: this.nft.address,
              tokenId: tokenOne,
              seller: seller,
              priceContract,
              initialPrice
            })
          })

          it('get auction', async function () {
            var r = await this.exchange.getAuction(this.nft.address, tokenOne)
            r.seller.should.be.equal(seller)
            r.priceContract.should.be.equal(priceContract)
            r.initialPrice.should.be.bignumber.equal(initialPrice)
            r.bidder.should.be.equal(ZERO_ADDRESS)
            r.bidPrice.should.be.bignumber.equal(new BN(0))
          })

          describe('cancelAuction', async function () {
            describe('failure', async function () {
              it('not seller nor operator', async function () {
                await expectRevert(
                  this.exchange.cancelAuction(this.nft.address, tokenOne, { from: buyer }),
                  'KIP17Auction: not seller nor operator'
                )
              })
            })

            describe('succeeded', async function () {

              testCancelAuction(operator, 'by operator')
              testCancelAuction(seller, 'by seller')

              function testCancelAuction(operator, testString) {
                describe(testString, async function () {
                  var result
                  beforeEach(async function () {
                    result = await this.exchange.cancelAuction(this.nft.address, tokenOne, {from:operator})
                  })

                  it('check log', async function () {
                    expectEvent.inLogs(result.logs, 'AuctionCancelled', {
                      kip17Contract: this.nft.address,
                      tokenId: tokenOne,
                      operator
                    })
                  })

                  it('order should be empty', async function () {
                    var r = await this.exchange.getAuction(this.nft.address, tokenOne)
                    r.seller.should.be.equal(ZERO_ADDRESS)
                    r.priceContract.should.be.equal(ZERO_ADDRESS)
                    r.initialPrice.should.be.bignumber.equal(new BN(0))
                    r.bidder.should.be.equal(ZERO_ADDRESS)
                    r.bidPrice.should.be.bignumber.equal(new BN(0))
                  })
                })

              } 

            })
          })

          describe('bid', async function() {

            describe('failure', async function() {
              it('insufficient balance', async function() {
                var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                await expectRevert(
                  this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, initialPrice, data, {from:tokenHolderThree}),
                  'SafeMath: subtraction overflow')
              })
              it('send wrong currency', async function() {
                var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                if(currency === 'KLAY') {
                  await expectRevert(
                    this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, initialPrice, data, {from:bidder1}),
                    'KIP17Auction: priceContract not matched')
                } else {
                  await expectRevert(
                    this.exchange.bidKLAY(this.nft.address, tokenOne, {value:initialPrice}),
                    'KIP17Auction: priceContract is not indicates KLAY(0)')
                }
              })
              it('lower price', async function() {
                if(currency === 'KLAY') {
                  await expectRevert(
                    this.exchange.bidKLAY(this.nft.address, tokenOne, {value:initialPrice.sub(new BN(3))}),
                    "KIP17Auction: bid price is lower than initial price")
                } else {
                  var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                  await expectRevert(
                    this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, initialPrice.sub(new BN(3)), data, {from:bidder1}),
                    "KIP17Auction: bid price is lower than initial price")
                }
              })
            })

            describe('succeeded', async function() {
              var result
              beforeEach(async function() {
                if(currency === 'KLAY') {
                  result = await this.exchange.bidKLAY(this.nft.address, tokenOne, {from: bidder1, value:bidPrice1})
                } else {
                  var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                  result = await this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, bidPrice1, data, {from:bidder1})
                }

              })

              describe('check log', async function() {
                it('AuctionBid', async function() {
                  let logs = this.exchange.constructor.decodeLogs(result.receipt.rawLogs)
                  expectEvent.inLogs(logs, 'AuctionBid', {
                    kip17Contract: this.nft.address,
                    tokenId: tokenOne,
                    bidder:bidder1,
                    bidPrice: bidPrice1,
                  })
                })

              })

              it('check get auction', async function() {
                var r = await this.exchange.getAuction(this.nft.address, tokenOne)
                r.seller.should.be.equal(seller)
                r.priceContract.should.be.equal(priceContract)
                r.initialPrice.should.be.bignumber.equal(initialPrice)
                r.bidder.should.be.equal(bidder1)
                r.bidPrice.should.be.bignumber.equal(bidPrice1)
              })

              describe('second bid', async function() {
                describe('fail cases', async function() {
                  it('low bid price', async function() {
                    if(currency === 'KLAY') {
                      await expectRevert(
                        this.exchange.bidKLAY(this.nft.address, tokenOne, {from: buyer, value:bidPrice1}),
                        "KIP17Auction: lower bid price")
                    } else {
                      var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                      await expectRevert(
                        this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, bidPrice1, data, {from:buyer}),
                        "KIP17Auction: lower bid price")
                    }
                  })
                })

                describe('succeeded', async function() {
                  beforeEach(async function() {
                    if(currency === 'KLAY') {
                      result = await this.exchange.bidKLAY(this.nft.address, tokenOne, {from: buyer, value:bidPrice2})
                    } else {
                      var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                      result = await this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, bidPrice2, data, {from:buyer})
                    }

                  })

                  describe('check log', async function() {
                    it('AuctionBid', async function() {
                      let logs = this.exchange.constructor.decodeLogs(result.receipt.rawLogs)
                      expectEvent.inLogs(logs, 'AuctionBid', {
                        kip17Contract: this.nft.address,
                        tokenId: tokenOne,
                        bidder:buyer,
                        bidPrice: bidPrice2,
                      })
                    })
                  })

                  describe('finalize auction', async function() {
                    var fees
                    var remaining
                    var result
                    beforeEach(async function() {
                      remaining = bidPrice2.add(new BN(0))
                      fees = new Array(ratiosInBp.length)
                      for(var i = 0; i < ratiosInBp.length; i++) {
                        fees[i] = bidPrice2.mul(ratiosInBp[i]).div(basisPoint)
                        remaining = remaining.sub(fees[i])
                      }
                      result = await this.exchange.finalizeAuction(this.nft.address, tokenOne, {from:operator})
                    })

                    describe('check log', async function() {
                      it('AuctionFinalized', async function() {
                        expectEvent.inLogs(result.logs, 'AuctionFinalized', {
                          kip17Contract: this.nft.address,
                          tokenId: tokenOne,
                          seller,
                          priceContract,
                          price: bidPrice2,
                          buyer,
                        })
                      })

                      it('SettlementAdded', async function() {
                        let logs = this.settlement.constructor.decodeLogs(result.receipt.rawLogs)
                        expectEvent.inLogs(logs, 'SettlementAdded', {
                          kip17Contract: this.nft.address,
                          tokenId: tokenOne,
                          seller,
                          priceContract,
                          price: bidPrice2,
                          buyer,
                        })
                        let l = logs.filter(e=>e.event === 'SettlementAdded')[0]
                        l.args.feeReceivers.map((x,i)=>{
                          x.should.be.equal(receivers[i])
                        })
                        l.args.fees.map((x,i)=>{
                          x.should.be.bignumber.equal(fees[i])
                        })
                      })

                      it('NFT transfer', async function() {
                        let logs = this.nft.constructor.decodeLogs(result.receipt.rawLogs)
                        expectEvent.inLogs(logs, 'Transfer', {
                          from: seller,
                          to: this.settlement.address,
                          tokenId: tokenOne
                        })
                      })
                    })

                    describe('check other values', async function() {
                      it('check get auction', async function() {
                        var r = await this.exchange.getAuction(this.nft.address, tokenOne)
                        r.seller.should.be.equal(ZERO_ADDRESS)
                        r.priceContract.should.be.equal(ZERO_ADDRESS)
                        r.initialPrice.should.be.bignumber.equal(new BN(0))
                        r.bidder.should.be.equal(ZERO_ADDRESS)
                        r.bidPrice.should.be.bignumber.equal(new BN(0))
                      })

                      it('check settlement', async function() {
                        var r = await this.settlement.getSettlement(this.nft.address, tokenOne)
                        r.seller.should.be.equal(seller)
                        r.priceContract.should.be.equal(priceContract)
                        r.price.should.be.bignumber.equal(bidPrice2)
                        r.buyer.should.be.equal(buyer)

                        for(var i = 0; i < receivers.length; i++) {
                          r.feeReceivers[i].should.be.equal(receivers[i])
                          r.fees[i].should.be.bignumber.equal(fees[i])
                        }
                      })

                    })

                  })

                })
              })

            })
          })

        })
      })

    })

  }

  describe('approver', async function() {
    var priceContract = ZERO_ADDRESS
    describe('approve', async function() {
      var result 
      beforeEach(async function() {
        await this.nft.setApprovalForAll(this.exchange.address, true, {from: seller})
        result = await this.nft.approve(approver, tokenOne, {from: seller});
      })

      it('check log', async function() {
        expectEvent.inLogs(result.logs, 'Approval', {
          owner: seller,
          approved: approver,
          tokenId: tokenOne
        })
      })

      describe('place auction', async function() {
        var result
        beforeEach(async function() {
          result = await this.exchange.placeAuction(this.nft.address, tokenOne, priceContract, initialPrice, { from: approver })
        })

        it('check logs', async function () {
          expectEvent.inLogs(result.logs, 'AuctionPlaced', {
            kip17Contract: this.nft.address,
            tokenId: tokenOne,
            seller,
            priceContract,
            initialPrice
          })
        })

        it('get auction', async function () {
          var r = await this.exchange.getAuction(this.nft.address, tokenOne)
          r.seller.should.be.equal(seller)
          r.priceContract.should.be.equal(priceContract)
          r.initialPrice.should.be.bignumber.equal(initialPrice)
          r.bidder.should.be.equal(ZERO_ADDRESS)
          r.bidPrice.should.be.bignumber.equal(new BN(0))
        })
      })
    })

    describe('approveForAll', async function() {
      var result 
      beforeEach(async function() {
        await this.nft.setApprovalForAll(this.exchange.address, true, {from: seller})
        result = await this.nft.setApprovalForAll(approver, true, {from: seller});
      })

      it('check log', async function() {
        expectEvent.inLogs(result.logs, 'ApprovalForAll', {
          owner: seller,
          operator: approver,
          approved:true,
        })
      })

      describe('place auction', async function() {
        var result
        beforeEach(async function() {
          result = await this.exchange.placeAuction(this.nft.address, tokenOne, priceContract, initialPrice, { from: approver })
        })

        it('check logs', async function () {
          expectEvent.inLogs(result.logs, 'AuctionPlaced', {
            kip17Contract: this.nft.address,
            tokenId: tokenOne,
            seller,
            priceContract,
            initialPrice 
          })
        })

        it('get auction', async function () {
          var r = await this.exchange.getAuction(this.nft.address, tokenOne)
          r.seller.should.be.equal(seller)
          r.priceContract.should.be.equal(priceContract)
          r.initialPrice.should.be.bignumber.equal(initialPrice)
          r.bidder.should.be.equal(ZERO_ADDRESS)
          r.bidPrice.should.be.bignumber.equal(new BN(0))
        })
      })
    })
  })

})
