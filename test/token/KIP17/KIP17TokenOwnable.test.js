const { BN, constants, expectEvent } = require('openzeppelin-test-helpers');
const { inTransaction } = require('openzeppelin-test-helpers/src/expectEvent');
const shouldFail = require('../../helpers/shouldFail');
const { ZERO_ADDRESS } = constants;

const KIP17TokenOwnable = artifacts.require('KIP17TokenOwnable.sol');

contract('KIP17', function ([_, creator, tokenOwner, other, ...accounts]) {
  beforeEach(async function () {
    this.token = await KIP17TokenOwnable.new('test', 'TST', tokenOwner, { from: creator });
  });

  describe('check token owner', async function() {
    it('check owner', async function() {
      (await this.token.owner()).should.be.equal(tokenOwner)
    })

  });

});
