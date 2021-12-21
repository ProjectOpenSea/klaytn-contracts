# klaytn-contracts

This repository contains contracts that are helpful to building blockchain applications on Klaytn.

Some files were derived from [openzeppelin contracts v2.3.0](https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v2.3.0).

# Security

WARNING: Please take special care when you use this code in production. We take no responsibility for any security problems you might experience.
If you find any security problems in the source code, please report it to developer@klaytn.com.

# Prerequisites

The following packages should be installed before using this source code.

* jq
* git
* docker
* Node v16.11.0

# Package Installation

Please install node packages first.

```bash
$ npm install
```

# How to run Ganache

[Ganache](https://www.trufflesuite.com/ganache) is a local blockchain environment for easy testing.
Klaytn is a fork of Ethereum and compatible with Constantinople EVM, so you can use Ganache for testing.
To run a Ganache, execute the following command:

```bash
$ npm run run:ganache
```

This ganache network is defined as "development" network in [truffle-config.js](truffle-config.js)

# How to run a Local Klaytn Network

You can easily deploy a local Klaytn network via the following command:

```bash
$ npm run run:klaytn
```

To see the execution logs, run `npm run run:klaytn:log`.
To stop the network, run `npm run run:klaytn:stop`.
To resume the network, run `npm run run:klaytn:resume`.
To completely terminate the network, run `npm run run:klaytn:terminate`.
To remove log files, run `npm run run:klaytn:cleanlog`.

# How to Test Contracts

Just execute the command as follows:

```bash
$ npm run test:ganache

# To run a specific test, execute the below.
$ npm run test:ganache -- ./test/token/KIP7/KIP7.test.js

# To run a test on a local klaytn network, execute the below.
$ npm run test:local
$ npm run test:local -- ./test/token/KIP7/KIP7.test.js
```

# How to Deploy Contracts
Deployment script is in [2_contract_migration.js](./contracts/migrations/2_contract_migration.js) which needs to be 
updated in case of adding any additional contracts that supposed to be deployed.

## Deploying a contract to the local network

Add `LOCAL_DEPLOYMENT_ACCOUNT_PRIVATE_KEY` into `.env` file (see `.env.sample` for example) and run:

```bash
$ npm run deploy:local
```

## Deploying a contract to Baobab

Add `BAOBAB_DEPLOYMENT_ACCOUNT_PRIVATE_KEY` into `.env` file (see `.env.sample` for example).

### Using an EN

Add `BAOBAB_NODE_URL` into `.env` file (see `.env.sample` for example) and run:
```bash
$ npm run deploy:baobab
```


### Using KAS

Also, you can use [KAS](http://www.klaytnapi.com) instead of your own EN. You need to create the `.env` file (see 
`.env.sample` for example) and fill in the following environmental variables: `BAOBAB_DEPLOYMENT_ACCOUNT_PRIVATE_KEY`, 
`KAS_ACCESS_KEY` and `KAS_SECRET_ACCESS_KEY`.

```bash
$ npm run deploy:kasBaobab
```

## Deploying a contract to Cypress

Add `CYPRESS_DEPLOYMENT_ACCOUNT_PRIVATE_KEY` into `.env` file (see `.env.sample` for example).

### Using an EN
Add `CYPRESS_NODE_URL` into `.env` file (see `.env.sample` for example) and run:
```bash
$ npm run deploy:cypress
```

### Using KAS

Also, you can use [KAS](http://www.klaytnapi.com) instead of your own EN. Add `KAS_ACCESS_KEY` and 
`KAS_SECRET_ACCESS_KEY` into `.env` file (see `.env.sample` for example) and run:

```bash
$ npm run deploy:kasCypress
```

# How to verify contracts
Submit a request on KlaytnScope support page:
* for Baobab: https://baobab.scope.klaytn.com/contract/submission
* for Cypress: https://scope.klaytn.com/contract/submission
