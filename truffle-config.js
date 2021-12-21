/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require('truffle-hdwallet-provider-klaytn')
const Caver = require('caver-js')
const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    // for ganache
    development: {
      host: '127.0.0.1',     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: '*',       // Any network (default: none)
      gas: 80000000
    },
    local: {
      provider: () => {
        return new HDWalletProvider(process.env.LOCAL_DEPLOYMENT_ACCOUNT_PRIVATE_KEY, 'http://localhost:8551')
      },
      network_id: '203', //Klaytn baobab testnet's network id
      gas: '8500000',
      gasPrice: null
    },
    kasBaobab: {
      provider: () => {
        const option = {
          headers: [
            {
              name: 'Authorization',
              value: 'Basic ' + Buffer.from(process.env.KAS_ACCESS_KEY + ':' + process.env.KAS_SECRET_ACCESS_KEY).toString('base64')
            },
            { name: 'x-chain-id', value: '1001' }
          ],
          keepAlive: false
        }
        return new HDWalletProvider(process.env.BAOBAB_DEPLOYMENT_ACCOUNT_PRIVATE_KEY, new Caver.providers.HttpProvider('https://node-api.klaytnapi.com/v1/klaytn', option))
      },
      network_id: '1001', //Klaytn baobab testnet's network id
      gas: '8500000',
      gasPrice: '25000000000'
    },
    kasCypress: {
      provider: () => {
        const option = {
          headers: [
            {
              name: 'Authorization',
              value: 'Basic ' + Buffer.from(process.env.KAS_ACCESS_KEY + ':' + process.env.KAS_SECRET_ACCESS_KEY).toString('base64')
            },
            { name: 'x-chain-id', value: '8217' }
          ],
          keepAlive: false
        }
        return new HDWalletProvider(process.env.CYPRESS_DEPLOYMENT_ACCOUNT_PRIVATE_KEY, new Caver.providers.HttpProvider('https://node-api.klaytnapi.com/v1/klaytn', option))
      },
      network_id: '8217', //Klaytn baobab testnet's network id
      gas: '8500000',
      gasPrice: '25000000000'
    },
    baobab: {
      provider: () => {
        return new HDWalletProvider(process.env.BAOBAB_DEPLOYMENT_ACCOUNT_PRIVATE_KEY, process.env.BAOBAB_NODE_URL)
      },
      network_id: '1001', //Klaytn baobab testnet's network id
      gas: '8500000',
      gasPrice: null
    },
    cypress: {
      provider: () => {
        return new HDWalletProvider(process.env.CYPRESS_DEPLOYMENT_ACCOUNT_PRIVATE_KEY, process.env.CYPRESS_NODE_URL)
      },
      network_id: '8217', //Klaytn mainnet's network id
      gas: '8500000',
      gasPrice: null
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.5.16',    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 1000000,
          details: { yul: true, deduplicate: true, cse: true, constantOptimizer: true }
        },
        evmVersion: 'constantinople'
      }
    }
  }
}
