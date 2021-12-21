var erc20Proxy = artifacts.require('ERC20Proxy')
var erc721Proxy = artifacts.require('ERC721Proxy')
var wklay = artifacts.require('WETH9')
var exchange = artifacts.require('Exchange')
var erc1155Proxy = artifacts.require('ERC1155Proxy')
var staticCallProxy = artifacts.require('StaticCallProxy')
var multiAssetProxy = artifacts.require('MultiAssetProxy')
var coordinatorRegistry = artifacts.require('CoordinatorRegistry')
var coordinator = artifacts.require('Coordinator')
var devUtils = artifacts.require('DevUtils')
var erc20BridgeProxy = artifacts.require('ERC20BridgeProxy');
var forwarder = artifacts.require('Forwarder')
var libAssetData = artifacts.require('LibAssetData')
var libDydxBalance = artifacts.require('LibDydxBalance')
var libOrderTransferSimulation = artifacts.require('LibOrderTransferSimulation')
var libTransactionDecoder = artifacts.require('LibTransactionDecoder')
var libFillResults = artifacts.require('LibFillResults')
var libSafeMath = artifacts.require('LibSafeMath')
var libMath = artifacts.require('LibMath')

var chainId = 1001

module.exports = async function(deployer) {
  await deployer.deploy(exchange, chainId)
  await deployer.deploy(erc20Proxy)
  await deployer.deploy(erc721Proxy)
  await deployer.deploy(erc1155Proxy)
  await deployer.deploy(staticCallProxy)
  await deployer.deploy(multiAssetProxy)
  await deployer.deploy(coordinatorRegistry)
  await deployer.deploy(coordinator, exchange.address, chainId)
  await deployer.deploy(erc20BridgeProxy)
  await deployer.deploy(wklay)

  await deployer.deploy(libMath)
  await deployer.deploy(libSafeMath)
  await deployer.deploy(libAssetData)

  await deployer.link(libAssetData, libDydxBalance)
  await deployer.deploy(libDydxBalance)

  await deployer.link(libSafeMath, libFillResults)
  await deployer.deploy(libFillResults)

  await deployer.link(libFillResults, libOrderTransferSimulation)
  await deployer.deploy(libOrderTransferSimulation)
  await deployer.deploy(libTransactionDecoder)

  await deployer.link(libAssetData, devUtils)
  await deployer.link(libDydxBalance, devUtils)
  await deployer.link(libOrderTransferSimulation, devUtils)
  await deployer.link(libTransactionDecoder, devUtils)
  await deployer.deploy(devUtils, exchange.address, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000")

  var erc20ProxyDeployed = await erc20Proxy.deployed()
  var erc721ProxyDeployed = await erc721Proxy.deployed()
  var erc1155ProxyDeployed = await erc1155Proxy.deployed()
  var multiAssetProxyDeployed = await multiAssetProxy.deployed()
  var exchangeDeployed = await exchange.deployed()
  var erc20BridgeProxyDeployed = await erc20BridgeProxy.deployed()

  await erc20ProxyDeployed.addAuthorizedAddress(exchange.address)
  await erc721ProxyDeployed.addAuthorizedAddress(exchange.address)
  await erc1155ProxyDeployed.addAuthorizedAddress(exchange.address)
  await multiAssetProxyDeployed.addAuthorizedAddress(exchange.address)

  // Multi asset proxy
  await erc20ProxyDeployed.addAuthorizedAddress(multiAssetProxy.address)
  await erc721ProxyDeployed.addAuthorizedAddress(multiAssetProxy.address)
  await erc1155ProxyDeployed.addAuthorizedAddress(multiAssetProxy.address)
  await multiAssetProxyDeployed.registerAssetProxy(erc20Proxy.address)
  await multiAssetProxyDeployed.registerAssetProxy(erc721Proxy.address)
  await multiAssetProxyDeployed.registerAssetProxy(erc1155Proxy.address)
  await multiAssetProxyDeployed.registerAssetProxy(staticCallProxy.address)

  // Register the asset proxies to the exchange
  await exchangeDeployed.registerAssetProxy(erc20Proxy.address)
  await exchangeDeployed.registerAssetProxy(erc721Proxy.address)
  await exchangeDeployed.registerAssetProxy(erc1155Proxy.address)
  await exchangeDeployed.registerAssetProxy(multiAssetProxy.address)
  await exchangeDeployed.registerAssetProxy(staticCallProxy.address)

  await exchangeDeployed.registerAssetProxy(erc20BridgeProxy.address)
  await erc20BridgeProxyDeployed.addAuthorizedAddress(exchange.address)
  await erc20BridgeProxyDeployed.addAuthorizedAddress(multiAssetProxy.address)
  await multiAssetProxyDeployed.registerAssetProxy(erc20BridgeProxy.address)

  await deployer.deploy(forwarder, exchange.address, "0x0000000000000000000000000000000000000000", wklay.address)

  console.log({exchange:exchange.address,
    erc20Proxy:erc20Proxy.address,
    erc721Proxy:erc721Proxy.address,
    erc1155Proxy:erc1155Proxy.address,
    staticCallProxy:staticCallProxy.address,
    multiAssetProxy:multiAssetProxy.address,
    coordinatorRegistry:coordinatorRegistry.address,
    coordinator:coordinator.address,
    devUtils:devUtils.address,
    erc20BridgeProxy:erc20BridgeProxy.address,
    forwarder:forwarder.address,
    wklay:wklay.address})
};
