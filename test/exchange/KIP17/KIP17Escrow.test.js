
const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const expectRevert = require('../../helpers/expectRevert')
const { ZERO_ADDRESS } = constants;
const Caver = require('caver-js');
const Contract = require('caver-js/packages/caver-contract');
const { isTxHash } = require('caver-js/packages/caver-utils');

const caver = new Caver();

const _sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const KIP17TokenWithCreator = artifacts.require('KIP17TokenWithCreator');
const KIP7Token = artifacts.require('KIP7Token')
const KIP17Escrow = artifacts.require('KIP17Escrow')

contract('KIP17Escrow', function(accounts) {
  const [operator, seller, buyer, tokenHolderThree, feeReceiver1, feeReceiver2, approver, ...otherAccounts] = accounts;
  const initialURI = 'https://token-cdn-domain/1.json';
  const name = 'NFT contract'
  const symbol = 'NFT'
  const tokenId = '1' 
  const feeReceivers = [feeReceiver1, feeReceiver2]
  const feeRatiosInBp = [new BN(1000), new BN(25000)]
  const price = new BN(1000000)
  const basisPoint = new BN(100000)
  const expirationPeriod = 4

  beforeEach(async function () {
    this.ft = await KIP7Token.new('FT contract', 'FT', 18, new BN('1000000000000000000000000000000'))
    this.nft = await KIP17TokenWithCreator.new(name, symbol)
    this.escrow = await KIP17Escrow.new()

    await this.ft.transfer(seller, new BN('100000000000'))
    await this.ft.transfer(buyer, new BN('100000000000'))

    await this.nft.mintWithTokenURI(buyer, tokenId, initialURI, {from:operator})
  });

  shouldBehaveEscrow('KLAY')
  shouldBehaveEscrow('KIP17')

  function shouldBehaveEscrow(currency) {
    var priceContract
    var getBalance
    var transfer
    describe(`using ${currency}`, async function () {
      beforeEach(async function () {
        if (currency === 'KLAY') {
          priceContract = ZERO_ADDRESS
          getBalance = web3.eth.getBalance
          transfer = async function (to, amount, options) {
            var from = operator
            if (options) {
              from = options.from
            }
            await web3.eth.sendTransaction({ to, value: amount, from })
          }
        } else {
          priceContract = this.ft.address
          getBalance = this.ft.balanceOf
          transfer = this.ft.transfer
        }
      })

      describe('openEscrow', async function () {
        var result
        var remaining
        var fees
        var expirationTime
        beforeEach(async function () {
          remaining = price.add(new BN(0))
          fees = new Array(feeRatiosInBp.length)
          for (var i = 0; i < feeRatiosInBp.length; i++) {
            fees[i] = price.mul(feeRatiosInBp[i]).div(basisPoint)
            remaining = remaining.sub(fees[i])
          }
          expirationTime = parseInt(Date.now() / 1000) + expirationPeriod;
          await transfer(this.escrow.address, price)
          result = await this.escrow.openEscrow(this.nft.address, tokenId, seller, priceContract, price, buyer, feeReceivers, fees, expirationTime)
        })

        it('check logs', async function () {
          expectEvent.inLogs(result.logs, 'EscrowOpened', {
            kip17Contract: this.nft.address,
            tokenId,
            seller,
            priceContract,
            price,
            buyer,
            expirationTime: new BN(expirationTime)
          })
          let l = result.logs.filter(e => e.event === 'EscrowOpened')[0]
          l.args.feeReceivers.map((x, i) => {
            x.should.be.equal(feeReceivers[i])
          })
          l.args.fees.map((x, i) => {
            x.should.be.bignumber.equal(fees[i])
          })
        })

        it('getEscrow', async function () {
          var r = await this.escrow.getEscrow(this.nft.address, tokenId)
          r.seller.should.be.equal(seller)
          r.priceContract.should.be.equal(priceContract)
          r.price.should.be.bignumber.equal(price)
          r.buyer.should.be.equal(buyer)
          r.feeReceivers.map((x, i) => {
            x.should.be.equal(feeReceivers[i])
          })
          r.fees.map((x, i) => {
            x.should.be.bignumber.equal(fees[i])
          })
        })

        describe('revokeEscrow', async function () {
          describe('fail cases', async function () {
            it('unauthorized account', async function () {
              await expectRevert(
                this.escrow.revokeEscrow(this.nft.address, tokenId, { from: tokenHolderThree }),
                'KIP17Escrow: not allowed'
              )
            })

            it('already expired', async function () {
              await _sleep(expirationPeriod * 1000)
              await expectRevert(
                this.escrow.revokeEscrow(this.nft.address, tokenId, { from: operator }),
                'KIP17Escrow: already expired'
              )
            })

            it('not permitted to transfer the NFT', async function () {
              await expectRevert(
                this.escrow.revokeEscrow(this.nft.address, tokenId, { from: operator }),
                'KIP17Escrow: failed to transfer nft to revert escrow'
              )
            })
          })

          describe('nft send', async function() {
            beforeEach(async function() {
              await this.nft.transferFrom(buyer, this.escrow.address, tokenId);
            })

            revokeEscrow(operator, 'by operator', true)
            revokeEscrow(seller, 'by seller', true)
            revokeEscrow(buyer, 'by buyer', false)
          })

          describe('set approval for all ', async function() {
            beforeEach(async function() {
              await this.nft.setApprovalForAll(this.escrow.address, true, { from: buyer })
            })

            revokeEscrow(operator, 'by operator', true)
            revokeEscrow(seller, 'by seller', true)
            revokeEscrow(buyer, 'by buyer', false)
          })

          describe('approve', async function() {
            beforeEach(async function() {
              await this.nft.approve(this.escrow.address, tokenId, { from: buyer })
            })

            revokeEscrow(operator, 'by operator', true)
            revokeEscrow(seller, 'by seller', true)
            revokeEscrow(buyer, 'by buyer', false)
          })

          function revokeEscrow(operator, testString, checkBuyerBalance) {
            describe(testString, async function () {
              var result, buyerBalance

              beforeEach(async function () {
                buyerBalance = new BN(await getBalance(buyer))
                result = await this.escrow.revokeEscrow(this.nft.address, tokenId, { from: operator })
              })

              describe('check logs', async function () {
                it('EscrowRevoked', async function () {
                  expectEvent.inLogs(result.logs, 'EscrowRevoked', {
                    kip17Contract: this.nft.address,
                    tokenId,
                    operator
                  })
                })

                it('NFT transfer', async function () {
                  let logs = this.nft.constructor.decodeLogs(result.receipt.rawLogs)
                  expectEvent.inLogs(logs, 'Transfer', {
                    from: buyer,
                    to: seller,
                    tokenId
                  })
                })
              })

              it('check balance of buyer', async function () {
                if (checkBuyerBalance) {
                  var b = new BN(await getBalance(buyer))
                  b.should.be.bignumber.equal(buyerBalance.add(price))
                }
              })

              it('check balance of seller', async function () {
                (await this.nft.ownerOf(tokenId)).should.be.equal(seller)
              })
            })
          }
        })

        describe('closeEscrow', async function () {
          describe('fail cases', async function () {
            it('not expired yet', async function () {
              await expectRevert(
                this.escrow.closeEscrow(this.nft.address, tokenId, { from: operator }),
                'KIP17Escrow: not expired yet'
              )
            })
            it('unauthorized account', async function () {
              await _sleep(expirationPeriod * 1000)
              await expectRevert(
                this.escrow.closeEscrow(this.nft.address, tokenId, { from: tokenHolderThree }),
                'KIP17Escrow: not allowed'
              )
            })
          })

          closeEscrow(operator, "by operator")
          closeEscrow(seller, "by seller")
          closeEscrow(buyer, "by buyer")

          async function closeEscrow(operator, testString) {
            describe(testString, async function () {
              var result
              var sellerBalance
              var buyerBalance
              var receiversBalance
              beforeEach(async function () {
                sellerBalance = new BN(await getBalance(seller))
                buyerBalance = new BN(await getBalance(buyer))
                receiversBalance = new Array(feeReceivers.length)
                for (var i = 0; i < feeReceivers.length; i++) {
                  receiversBalance[i] = new BN(await getBalance(feeReceivers[i]))
                }
                await _sleep(expirationPeriod * 1000)
                result = await this.escrow.closeEscrow(this.nft.address, tokenId, { from: operator })
              })

              it('check log', async function () {
                expectEvent.inLogs(result.logs, 'EscrowClosed', {
                  kip17Contract: this.nft.address,
                  tokenId: tokenId,
                  operator
                })
              })

              it('check nft owner', async function () {
                (await this.nft.ownerOf(tokenId)).should.be.equal(buyer)
              })

              it('check balance of feeReceivers', async function () {
                for (var i = 0; i < feeReceivers.length; i++) {
                  (new BN(await getBalance(feeReceivers[i]))).should.be.bignumber.equal(receiversBalance[i].add(fees[i]))
                }
              })

              it('check balance of seller', async function () {
                if(operator !== seller) {
                  (new BN(await getBalance(seller))).should.be.bignumber.equal(sellerBalance.add(remaining))
                }
              })
            })
          }

        })
      })

    })
  }
})