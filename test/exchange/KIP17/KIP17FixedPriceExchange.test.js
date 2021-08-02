
const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const expectRevert = require('../../helpers/expectRevert')
const { ZERO_ADDRESS } = constants;
const Caver = require('caver-js');

const caver = new Caver();

const _sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const KIP17TokenWithCreator = artifacts.require('KIP17TokenWithCreator');
const RoyaltyRegistry = artifacts.require('RoyaltyRegistry')
const RoyaltyInfo = artifacts.require('RoyaltyInfo')
const RoyaltyRouter = artifacts.require('RoyaltyRouter')
const KIP17FixedPriceExchange = artifacts.require('KIP17FixedPriceExchange')
const KIP7Token = artifacts.require('KIP7Token')
const KIP17Escrow = artifacts.require('KIP17Escrow')

contract('KIP17TokenWithCreator with FixedPriceExchange', function(accounts) {
  const [operator, seller, buyer, tokenHolderThree, feeReceiver1, feeReceiver2, approver, ...otherAccounts] = accounts;
  const initialURI = 'https://token-cdn-domain/1.json';
  const name = 'NFT contract'
  const symbol = 'NFT'
  const tokenOne = '1' 
  const tokenTwo = '2'
  const receivers = [feeReceiver1, feeReceiver2]
  const ratiosInBp = [new BN(1000), new BN(25000)]
  const price = new BN(1000000)
  const basisPoint = new BN(100000)
  const expirationPeriod = new BN(10)

  beforeEach(async function () {
    this.ft = await KIP7Token.new('FT contract', 'FT', 18, new BN('1000000000000000000000000000000'))
    this.nft = await KIP17TokenWithCreator.new(name, symbol)
    this.royaltyRouter = await RoyaltyRouter.new()
    this.royaltyRegistry = await RoyaltyRegistry.new()
    this.royaltyInfo = await RoyaltyInfo.new(this.nft.address)
    this.exchange = await KIP17FixedPriceExchange.new()
    this.escrow = await KIP17Escrow.new()

    await this.ft.transfer(seller, new BN('100000000000'))
    await this.ft.transfer(buyer, new BN('100000000000'))

    await this.nft.mintWithTokenURI(seller, tokenOne, initialURI, {from:operator})
    // await this.royaltyRouter.overrideAddress(this.nft.address, this.royaltyRegistry.address)
    // await this.royaltyRegistry.setRoyalty(this.nft.address, tokenOne, receivers, ratiosInBp, { from: seller})
    await this.royaltyRouter.overrideAddress(this.nft.address, this.royaltyInfo.address)
    await this.royaltyInfo.setRoyalty(tokenOne, receivers, ratiosInBp, { from: seller})

    await this.exchange.setRouter(this.royaltyRouter.address)
    await this.exchange.setEscrowContract(this.escrow.address)
    await this.exchange.setExpirationPeriod(expirationPeriod)

    await this.escrow.addOperator(this.exchange.address)
  });

  shouldBehaveExchange('KLAY')
  // shouldBehaveExchange('KIP7')

  function shouldBehaveExchange(currency) {
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

      describe('putOnSale', async function () {
        describe('expect failure', async function () {
          it('not owner', async function () {
            await expectRevert(
              this.exchange.putOnSale(this.nft.address, tokenOne, priceContract, price),
              'KIP17FixedPriceExchange: not owner'
            )
          })

          it('not KLAY or KIP7 address', async function () {
            await expectRevert(
              this.exchange.putOnSale(this.nft.address, tokenOne, this.nft.address, price, { from: seller }),
              'KIP17FixedPriceExchange: not KLAY nor KIP7'
            )
          })

          it('not approved', async function() {
            await expectRevert(
              this.exchange.putOnSale(this.nft.address, tokenOne, priceContract, price, { from: seller }),
              'KIP17FixedPriceExchange: this exchange should be approved first'
            )
          })

        })

        describe('expect succeeded', async function () {
          var result = null
          beforeEach(async function () {
            await this.nft.approve(this.exchange.address, tokenOne, {from:seller})
            result = await this.exchange.putOnSale(this.nft.address, tokenOne, priceContract, price, { from: seller })
          })

          it('check logs', async function () {
            expectEvent.inLogs(result.logs, 'SalePlaced', {
              kip17Contract: this.nft.address,
              tokenId: tokenOne,
              seller: seller,
              priceContract,
              price
            })
          })

          it('get sale', async function () {
            var r = await this.exchange.getSaleInfo(this.nft.address, tokenOne)
            r.seller.should.be.equal(seller)
            r.priceContract.should.be.equal(priceContract)
            r.price.should.be.bignumber.equal(price)
          })

          describe('cancelSale', async function () {
            describe('failure', async function () {
              it('not seller nor operator', async function () {
                await expectRevert(
                  this.exchange.cancelSale(this.nft.address, tokenOne, { from: buyer }),
                  'KIP17FixedPriceExchange: not seller nor operator'
                )
              })
            })

            describe('succeeded', async function () {
              describe('by operator', async function () {
                var result
                beforeEach(async function () {
                  result = await this.exchange.cancelSale(this.nft.address, tokenOne)
                })

                it('check log', async function () {
                  expectEvent.inLogs(result.logs, 'SaleCancelled', {
                    kip17Contract: this.nft.address,
                    tokenId: tokenOne,
                    operator
                  })
                })

                it('sale should be empty', async function () {
                  var r = await this.exchange.getSaleInfo(this.nft.address, tokenOne)
                  r.seller.should.be.equal(ZERO_ADDRESS)
                  r.priceContract.should.be.equal(ZERO_ADDRESS)
                  r.price.should.be.bignumber.equal(new BN(0))
                })
              })

              describe('by seller', async function () {
                var result
                beforeEach(async function () {
                  result = await this.exchange.cancelSale(this.nft.address, tokenOne, { from: seller })
                })

                it('check log', async function () {
                  expectEvent.inLogs(result.logs, 'SaleCancelled', {
                    kip17Contract: this.nft.address,
                    tokenId: tokenOne,
                    operator: seller
                  })
                })
              })
            })
          })

          describe('buy', async function() {

            describe('failure', async function() {
              it('insufficient balance', async function() {
                var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                await expectRevert(
                  this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, price, data, {from:tokenHolderThree}),
                  'SafeMath: subtraction overflow')
              })
              it('send wrong currency', async function() {
                var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                if(currency === 'KLAY') {
                  await expectRevert(
                    this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, price, data, {from:buyer}),
                    'KIP17FixedPriceExchange: priceContract not matched')
                } else {
                  await expectRevert(
                    this.exchange.buyInKLAY(this.nft.address, tokenOne, {value:price}),
                    'KIP17FixedPriceExchange: priceContract is not indicates KLAY(0)')
                }
              })
              it('price not matched', async function() {
                if(currency === 'KLAY') {
                  await expectRevert(
                    this.exchange.buyInKLAY(this.nft.address, tokenOne, {value:price.add(new BN(3))}),
                    "KIP17FixedPriceExchange: price not matched")
                } else {
                  var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                  await expectRevert(
                    this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, price.add(new BN(3)), data, {from:buyer}),
                    "KIP17FixedPriceExchange: price not matched")
                }
              })
            })

            describe('succeeded', async function() {
              var result
              var fees
              var remaining
              beforeEach(async function() {
                remaining = price.add(new BN(0))
                fees = new Array(ratiosInBp.length)
                for(var i = 0; i < ratiosInBp.length; i++) {
                  fees[i] = price.mul(ratiosInBp[i]).div(basisPoint)
                  remaining = remaining.sub(fees[i])
                }
                if(currency === 'KLAY') {
                  result = await this.exchange.buyInKLAY(this.nft.address, tokenOne, {from: buyer, value:price})
                } else {
                  var data = caver.abi.encodeParameters(['address', 'uint256'], [this.nft.address, tokenOne])
                  result = await this.ft.methods['safeTransfer(address,uint256,bytes)'](this.exchange.address, price, data, {from:buyer})
                }

              })

              describe('check log', async function() {
                it('SaleMatched', async function() {
                  let logs = this.exchange.constructor.decodeLogs(result.receipt.rawLogs)
                  expectEvent.inLogs(logs, 'SaleMatched', {
                    kip17Contract: this.nft.address,
                    tokenId: tokenOne,
                    seller,
                    priceContract,
                    price,
                    buyer,
                  })
                })

                it('EscrowOpened', async function() {
                  let logs = this.escrow.constructor.decodeLogs(result.receipt.rawLogs)
                  expectEvent.inLogs(logs, 'EscrowOpened', {
                    kip17Contract: this.nft.address,
                    tokenId: tokenOne,
                    seller,
                    priceContract,
                    price,
                    buyer,
                  })
                  let l = logs.filter(e=>e.event === 'EscrowOpened')[0]
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
                    to: buyer,
                    tokenId: tokenOne
                  })
                })

              })

              it('check get sale', async function() {
                var r = await this.exchange.getSaleInfo(this.nft.address, tokenOne)
                r.seller.should.be.equal(ZERO_ADDRESS)
                r.priceContract.should.be.equal(ZERO_ADDRESS)
                r.price.should.be.bignumber.equal(new BN(0))
              })

              it('check escrow', async function() {
                var r = await this.escrow.getEscrow(this.nft.address, tokenOne)
                r.seller.should.be.equal(seller)
                r.priceContract.should.be.equal(priceContract)
                r.price.should.be.bignumber.equal(price)
                r.buyer.should.be.equal(buyer)
                r.feeReceivers.map((x,i)=>{
                  x.should.be.equal(receivers[i])
                })
                r.fees.map((x,i)=>{
                  x.should.be.bignumber.equal(fees[i])
                })
              })

              describe('revokeEscrow', async function() {

                describe('test fail cases', async function() {
                  it('unauthorized account', async function() {
                    await expectRevert(
                      this.escrow.revokeEscrow(this.nft.address, tokenOne, {from:tokenHolderThree}),
                      'KIP17Escrow: not allowed'
                    )
                  })

                  it('already expired', async function() {
                    await _sleep(expirationPeriod * 1000)
                    await expectRevert(
                      this.escrow.revokeEscrow(this.nft.address, tokenOne, {from:operator}),
                      'KIP17Escrow: already expired'
                    )
                  })
                })

                revokeEscrow(operator, 'by operator')
                revokeEscrow(seller, 'by seller')
                revokeEscrow(buyer, 'by buyer')

                function revokeEscrow(operator, testString) {
                  describe(testString, async function() {
                    var result, buyerBalance

                    beforeEach(async function() {
                      await this.nft.setApprovalForAll(this.escrow.address, true, {from: buyer})
                      buyerBalance = new BN(await getBalance(buyer))
                      result = await this.escrow.revokeEscrow(this.nft.address, tokenOne, {from: operator})
                    })

                    describe('check logs', async function() {
                      it('EscrowRevoked', async function() {
                        expectEvent.inLogs(result.logs, 'EscrowRevoked', {
                          kip17Contract: this.nft.address,
                          tokenId:tokenOne,
                          operator
                        })
                      })

                      it('NFT transfer', async function() {
                        let logs = this.nft.constructor.decodeLogs(result.receipt.rawLogs)
                        expectEvent.inLogs(logs, 'Transfer', {
                          from: buyer,
                          to: seller,
                          tokenId:tokenOne
                        })
                      })
                    })

                    it('check balance of buyer', async function() {
                      if(operator !== buyer) {
                        var b = new BN(await getBalance(buyer))
                        b.should.be.bignumber.equal(buyerBalance.add(price))
                      }
                    })

                    it('check balance of seller', async function() {
                      (await this.nft.ownerOf(tokenOne)).should.be.equal(seller)
                    })
                  })

                }

              })

              describe('closeEscrow', async function() {
                describe('fail cases', async function() {
                  it('not expired yet', async function() {
                    await expectRevert(
                      this.escrow.closeEscrow(this.nft.address, tokenOne, {from:operator}),
                      'KIP17Escrow: not expired yet'
                    )
                  })
                  it('unauthorized account', async function() {
                    await _sleep(expirationPeriod * 1000)
                    await expectRevert(
                      this.escrow.closeEscrow(this.nft.address, tokenOne, {from: tokenHolderThree}),
                      'KIP17Escrow: not allowed'
                    )
                  })
                })

                closeEscrow(operator, "by operator")
                closeEscrow(seller, "by seller")
                closeEscrow(buyer, "by buyer")

                async function closeEscrow(operator, testString) {
                  describe(testString, async function() {
                    var result
                    var sellerBalance
                    var buyerBalance
                    var receiversBalance
                    beforeEach(async function() {
                      sellerBalance = new BN(await getBalance(seller))
                      buyerBalance = new BN(await getBalance(buyer))
                      receiversBalance = new Array(receivers.length)
                      for(var i = 0; i < receivers.length; i++) {
                        receiversBalance[i] = new BN(await getBalance(receivers[i]))
                      }
                      await _sleep(expirationPeriod * 1000)
                      result = await this.escrow.closeEscrow(this.nft.address, tokenOne, {from:operator})
                    })

                    it('check log', async function() {
                      expectEvent.inLogs(result.logs, 'EscrowClosed', {
                        kip17Contract: this.nft.address,
                        tokenId: tokenOne,
                        operator
                      })
                    })

                    it('check nft owner', async function() {
                      (await this.nft.ownerOf(tokenOne)).should.be.equal(buyer)
                    })

                    it('check balance of feeReceivers', async function() {
                      for(var i = 0; i < receivers.length; i++) {
                        (new BN(await getBalance(receivers[i]))).should.be.bignumber.equal(receiversBalance[i].add(fees[i]))
                      }
                    })

                    it('check balance of seller', async function() {
                      if(operator !== seller) {
                        (new BN(await getBalance(seller))).should.be.bignumber.equal(sellerBalance.add(remaining))
                      }
                    })

                    it('sale should be empty', async function () {
                      var r = await this.exchange.getSaleInfo(this.nft.address, tokenOne)
                      r.seller.should.be.equal(ZERO_ADDRESS)
                      r.priceContract.should.be.equal(ZERO_ADDRESS)
                      r.price.should.be.bignumber.equal(new BN(0))
                    })
                  })
                }
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

      describe('place sale', async function() {
        var result
        beforeEach(async function() {
          result = await this.exchange.putOnSale(this.nft.address, tokenOne, priceContract, price, { from: approver })
        })

        it('check logs', async function () {
          expectEvent.inLogs(result.logs, 'SalePlaced', {
            kip17Contract: this.nft.address,
            tokenId: tokenOne,
            seller,
            priceContract,
            price
          })
        })

        it('get sale', async function () {
          var r = await this.exchange.getSaleInfo(this.nft.address, tokenOne)
          r.seller.should.be.equal(seller)
          r.priceContract.should.be.equal(priceContract)
          r.price.should.be.bignumber.equal(price)
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

      describe('place sale', async function() {
        var result
        beforeEach(async function() {
          result = await this.exchange.putOnSale(this.nft.address, tokenOne, priceContract, price, { from: approver })
        })

        it('check logs', async function () {
          expectEvent.inLogs(result.logs, 'SalePlaced', {
            kip17Contract: this.nft.address,
            tokenId: tokenOne,
            seller,
            priceContract,
            price
          })
        })

        it('get sale', async function () {
          var r = await this.exchange.getSaleInfo(this.nft.address, tokenOne)
          r.seller.should.be.equal(seller)
          r.priceContract.should.be.equal(priceContract)
          r.price.should.be.bignumber.equal(price)
        })
      })
    })
  })

})
