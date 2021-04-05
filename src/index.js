const CaverExtKAS = require('caver-js-ext-kas')
const caver = new CaverExtKAS()
const kip17Addr = "0xf118d8397c450F0D3B013120FD4A0293e7e5dB89";
const chainId = 1001
const accessKeyId = "ACCESS_KEY"
const secretAccessKey = "SECRET_ACCESS_KEY"
const privateKey = "PRIVATE_KEY"

async function main() {
  caver.initKASAPI(chainId, accessKeyId, secretAccessKey)

  const blockNumber = await caver.rpc.klay.getBlockNumber()
  console.log('latest block number', blockNumber)

  const kip17 = new caver.kct.kip17(kip17Addr)
  console.log('total supply', await kip17.totalSupply())

  const keyringContainer = new caver.keyringContainer()
  const keyring = keyringContainer.keyring.createFromPrivateKey(privateKey)
  keyringContainer.add(keyring)

  kip17.setWallet(keyringContainer)

  const tokenId = '1'
  const uri = "http://test.url"
  const mintReceipt = await kip17.mintWithTokenURI(keyring.address, tokenId, uri, {from:keyring.address})
  console.log('mint receipt', mintReceipt)

  const transferReceipt = await kip17.transferFrom(keyring.address, keyring.address, tokenId, {from:keyring.address})
  console.log('transfer receipt', transferReceipt)

  const burnReceipt = await kip17.burn(tokenId, {from:keyring.address})
  console.log('transfer receipt', burnReceipt)
}

main()