
const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const expectRevert = require('../helpers/expectRevert')
const { ZERO_ADDRESS } = constants;
var should = require('chai').should();

const { expect } = require('chai');

const KIP17TokenWithCreator = artifacts.require('KIP17TokenWithCreator');
const RoyaltyRegistry = artifacts.require('RoyaltyRegistry')
const RoyaltyRouter = artifacts.require('RoyaltyRouter')

contract('KIP17TokenWithCreator with RoyaltyRegistry', function(accounts) {
  const [operator, tokenHolder, tokenHolderTwo, tokenHolderThree, ...otherAccounts] = accounts;
  const initialURI = 'https://token-cdn-domain/1.json';
  const name = 'NFT contract'
  const symbol = 'NFT'
  const tokenOne = '1' 
  const tokenTwo = '2'
  const receivers = [tokenHolderTwo]
  const ratiosInBp = [new BN(1000)]
  const price = new BN(1000000)
  const basisPoint = new BN(100000)

  beforeEach(async function () {
    this.token = await KIP17TokenWithCreator.new(name, symbol);
    this.royaltyRouter = await RoyaltyRouter.new();
    this.royaltyRegistry = await RoyaltyRegistry.new();

    await this.token.mintWithTokenURI(tokenHolder, tokenOne, initialURI, {from:operator})
  });

  describe('set royalty router', async function() {
    var result = null
    beforeEach(async function() {
      result = await this.royaltyRouter.overrideAddress(this.token.address, this.royaltyRegistry.address)
    })

    it('check log', async function() {
      expectEvent.inLogs(result.logs, 'RoyaltyOverride', {
        operator,
        nftContract: this.token.address,
        royaltyContract: this.royaltyRegistry.address
      })
    })

    it('check address', async function() {
      (await this.royaltyRouter.getOverrideAddress(this.token.address)).should.be.equal(this.royaltyRegistry.address)
    })

    describe('failed to set royalty', async function() {
      it('length not matched', async function() {
        await expectRevert(
          this.royaltyRegistry.setRoyalty(this.token.address, tokenOne, [tokenHolderTwo, tokenHolderThree], [1]),
          'RoyaltyRegistry: length not matched: receivers, reatiosInBp'
        )
      })
      it('not minted token', async function() {
        await expectRevert(
          this.royaltyRegistry.setRoyalty(this.token.address, tokenTwo, receivers, ratiosInBp),
          'RoyaltyRegistry: not creator'
        )
      })
    })

    describe('set royalty successfully', async function() {
      var result = null
      beforeEach(async function() {
        result = await this.royaltyRegistry.setRoyalty(this.token.address, tokenOne, receivers, ratiosInBp, {from:tokenHolder})
      })

      it('check log', async function() {
        expectEvent.inLogs(result.logs, 'RoyaltySet', {
          nftContract: this.token.address,
          tokenId: tokenOne,
        })

        const e = result.logs.filter(e=>e.event==='RoyaltySet')[0]
        e.args.receivers.should.be.deep.equal(receivers)
        e.args.ratiosInBp.map((x,i)=>{
          x.should.be.bignumber.equal(ratiosInBp[i])
        })
      })

      describe('get royalty', async function() {
        it('from registry', async function() {
          const result = await this.royaltyRegistry.getRoyalty(this.token.address, tokenOne, price)
          result.recipients.should.be.deep.equal(receivers)
          result.amounts.map((x,i)=>{
            x.should.be.bignumber.equal(price.mul(ratiosInBp[i]).div(basisPoint))
          })
        })
        it('from router', async function() {
          const result = await this.royaltyRouter.getRoyalty(this.token.address, tokenOne, price)
          result.recipients.should.be.deep.equal(receivers)
          result.amounts.map((x,i)=>{
            x.should.be.bignumber.equal(price.mul(ratiosInBp[i]).div(basisPoint))
          })
        })
      })

    })

    describe('transfer', async function() {
      var result = null
      beforeEach(async function() {
        result = await this.token.transferFrom(tokenHolder, tokenHolderTwo, tokenOne, {from:tokenHolder})
      })

      it('check log', async function() {
        expectEvent.inLogs(result.logs, 'Transfer', {
          from: tokenHolder,
          to:tokenHolderTwo,
          tokenId:tokenOne
        })
      })

      it('failed to set royalty', async function() {
        await expectRevert(
          this.royaltyRegistry.setRoyalty(this.token.address, tokenOne, receivers, ratiosInBp, {from:tokenHolder}),
          'RoyaltyRegistry: not owner'
        )
      })
    })

  });
})