const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const shouldFail = require('../helpers/shouldFail');
var should = require('chai').should();
const Caver = require('caver-js')

const KIP17Marketplace = artifacts.require('KIP17Marketplace')
const KIP17Mock = artifacts.require('KIP17Mock.sol');
const caver = new Caver()

contract('KIP17Marketplace', function([_, creator, seller, buyer]) {
  const firstTokenId = new BN(1);
  const secondTokenId = new BN(2);

  describe('feeRatio', function() {
    before(async function () {
      this.marketplace = await KIP17Marketplace.new({from:creator});
    });

    it('check the initial fee', async function(){
      (await this.marketplace.feeRatio()).should.be.bignumber.equal('0');
    });

    it('update the fee to 30', async function(){
      (await this.marketplace.setFeeRatio(new BN(30), {from:creator}));
      (await this.marketplace.feeRatio()).should.be.bignumber.equal('30');
    });

    it('update the fee to 100', async function(){
      await shouldFail.reverting.withMessage(this.marketplace.setFeeRatio(new BN(100), {from:creator}),
        "fee ratio cannot be over 100")
    });
  })

  describe('normal user scenario', function() {
    before(async function () {
      this.kip17 = await KIP17Mock.new({ from: creator});
      this.marketplace = await KIP17Marketplace.new({from:creator});
      await this.kip17.mint(seller, firstTokenId, {from:creator});
      await this.kip17.mint(seller, secondTokenId, {from:creator});
      this.sellAmount = new BN(100);
    });

    it('check the minted tokens', async function() {
      (await this.kip17.balanceOf(seller)).should.be.bignumber.equal('2');
    });

    it('sell:failed without approve', async function(){
      await shouldFail.reverting.withMessage(this.marketplace.sell(this.kip17.address, firstTokenId, this.sellAmount, {from:seller}),
        "KIP17: transfer caller is not owner nor approved");
    })

    it('make a sell order', async function(){
      await this.kip17.approve(this.marketplace.address, firstTokenId, {from:seller});
      await this.marketplace.sell(this.kip17.address, firstTokenId, this.sellAmount, {from:seller})
    })

    it('check the sell info', async function() {
      var result = await this.marketplace.getSellInfo(this.kip17.address, firstTokenId)
      result['0'].should.be.equal(seller);
      result['1'].should.be.bignumber.equal(this.sellAmount)
    })

    it('buy the sell', async function(){
      console.log('balance', await web3.eth.getBalance(seller))
      await this.marketplace.buy(this.kip17.address, firstTokenId, {from:buyer, value:this.sellAmount});
    })

    it('check the sell info again. Must be nil', async function() {
      var result = await this.marketplace.getSellInfo(this.kip17.address, firstTokenId)
      result['0'].should.be.equal('0x0000000000000000000000000000000000000000');
      result['1'].should.be.bignumber.equal('0')
    })
  })

  describe('revoke sell', function() {
    before(async function () {
      this.kip17 = await KIP17Mock.new({ from: creator});
      this.marketplace = await KIP17Marketplace.new({from:creator});
      await this.kip17.mint(seller, firstTokenId, {from:creator});
      await this.kip17.mint(seller, secondTokenId, {from:creator});
      this.sellAmount = new BN(1000);
    });

    it('make a sell order from wrong account', async function(){
      await shouldFail.reverting.withMessage(this.kip17.approve(this.marketplace.address, firstTokenId, {from: buyer}),
        "KIP17: approval to current owner");
      await shouldFail.reverting.withMessage(this.marketplace.sell(this.kip17.address, firstTokenId, this.sellAmount, {from:buyer}),
        "KIP17: transfer of token that is not own");
    })

    it('make a sell order', async function(){
      await this.kip17.approve(this.marketplace.address, firstTokenId, {from:seller});
      await this.marketplace.sell(this.kip17.address, firstTokenId, this.sellAmount, {from:seller})
    })

    it('check the sell info', async function() {
      var result = await this.marketplace.getSellInfo(this.kip17.address, firstTokenId)
      result['0'].should.be.equal(seller);
      result['1'].should.be.bignumber.equal(this.sellAmount)
    })

    it('revoke the sell by a wrong account', async function(){
      await shouldFail.reverting.withMessage(this.marketplace.revokeSell(this.kip17.address, firstTokenId, {from:buyer}),
        "Not the sellr")
    })

    it('revoke the sell', async function(){
      await this.marketplace.revokeSell(this.kip17.address, firstTokenId, {from:seller});
    })

    it('check the sell info again. Must be nil', async function() {
      var result = await this.marketplace.getSellInfo(this.kip17.address, firstTokenId)
      result['0'].should.be.equal('0x0000000000000000000000000000000000000000');
      result['1'].should.be.bignumber.equal('0')
    })
  })

});