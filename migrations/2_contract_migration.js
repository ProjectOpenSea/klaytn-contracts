var kip17 = artifacts.require('KIP17Token');

module.exports = function(deployer) {
  deployer.deploy(kip17, "KDC", "Kaist Digital Financial Specialist Course Token")
};
