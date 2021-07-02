const { BN, expectEvent } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = require('openzeppelin-test-helpers/src/constants');
const shouldFail = require('../../helpers/shouldFail');

const KIP17URIUpdatableToken = artifacts.require('KIP17URIUpdatableToken.sol');

contract('KIP17URIUpdatable', function([creator, ...accounts]) {
  const name = 'NFT URI Updatable Token'
  const symbol = 'NUT'
  const firstTokenId = new BN(100);
  const secondTokenId = new BN(200);
  const thirdTokenId = new BN(300);
  const nonExistentTokenId = new BN(999);
  const uri = 'https://test.uri';
  const newUri = 'https://test.uri.new';
  const contentHash = "0x640b6dee7a4b830bdfd52b5031a07fc2b12209f5b2e29e5d364a7d37f69d8076"

  const minter = creator;
  const [
    owner,
    newOwner,
    another
  ] = accounts;

  beforeEach(async function() {
    this.token = await KIP17URIUpdatableToken.new(name, symbol, {from: creator})
  })

  describe('updating URI', function() {
    beforeEach(async function() {
      ({logs: this.logs} = await this.token.mintWithTokenURIAndHash(owner, firstTokenId, uri, contentHash, {from: minter}));
      await this.token.mintWithTokenURI(owner, secondTokenId, uri, {from: minter});
    })

    it('unauthorized minting', async function() {
      await shouldFail.reverting.withMessage(
        this.token.mintWithTokenURIAndHash(owner, firstTokenId, uri, contentHash, {from: owner}),
        "MinterRole: caller does not have the Minter role"
      )
    })

    it('emits events', function() {
      expectEvent.inLogs(this.logs, 'Transfer',
      {
        from: ZERO_ADDRESS,
        to: owner,
        tokenId: firstTokenId,
      })
    })

    it('tokenURI should not be updatable if empty contentHash', async function() {
      await shouldFail.reverting.withMessage(
        this.token.updateTokenURI(secondTokenId, newUri, {from: minter}),
        "KIP17: empty contentHash")
    })

    it('tokenURI should not be updatable for wrong owner', async function() {
      await shouldFail.reverting.withMessage(
        this.token.updateTokenURI(firstTokenId, newUri, {from: minter}),
        "KIP17: transfer caller is not owner nor approved")
    })

    describe('update tokenURI', async function() {
      beforeEach(async function() {
        ({logs: this.logs} = await this.token.updateTokenURI(firstTokenId, newUri, {from: owner}));
      })

      it('check logs', async function() {
        expectEvent.inLogs(this.logs, 'URIUpdated', {
          updater: owner,
          tokenId: firstTokenId,
          uri: newUri
        })
      })

      it('check uri', async function() {
        (await this.token.tokenURI(firstTokenId)).should.equal(newUri)
      })

      it('check uri for the token minted by mintWithTokenURI', async function() {
        (await this.token.tokenURI(secondTokenId)).should.equal(uri)
      })
    })
  })
})
