const HDWalletProvider = require('@truffle/hdwallet-provider')
require('dotenv').config();

const mnemonic = process.env.MNEMONIC
const url = process.env.RPC_URL

module.exports = {
  networks: {
    cldev: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    ganache: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*',
    },
    kovan: {
      provider: () => {
        return new HDWalletProvider(mnemonic, url)
      },
      network_id: '42',
      skipDryRun: true
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(mnemonic, url)
      },
      network_id: '4',
      gas: 10000000,
      skipDryRun: true
    },
  },
  compilers: {
    solc: {
      version: '0.6.12',
    },
  },
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  },
  plugins: [
    'truffle-plugin-verify',
    'truffle-contract-size'
  ]
}
