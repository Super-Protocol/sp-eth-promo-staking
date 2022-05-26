# Super Protocol Execution Controller

## Local Dev Setup

1. Install dependencies:

    ```
    yarn
    ```

2. Create `.env` file:

    ```
    cp .env.example .env
    ```

3. Replace example environment variables to your values in `.env` file

## Useful commands

### Tests

```sh
$ npx hardhat test
$ npx hardhat test test/staking.test.ts --show-stack-traces
```

### Local node

```sh
$ npx hardhat node
$ npx hardhat run scripts/deploy.ts --network local
$ ethernal listen
```

### Mumbai

```sh
$ npx hardhat run scripts/deploy.ts --network mumbai
```

### Ethereum mainnet
```sh
$ npx hardhat run scripts/deploy.ts --network ethereum
```

## Verify on etherscan

npx hardhat verify --network ethereum <contract_address> <staking_initializer_address>

## Tasks

This task will deploy Superpro Token, PromoStaking and then initialize it:
```sh
npx hardhat initialize --network <network_name> --start <staking_start_block> --duration <staking_duration_in_blocks>
```

### Prettier and linter

```sh
$ npm run eslint
$ npm run prettier
$ npx prettier --write 'contracts/**/*.sol'
```

# Useful plugins and extensions

* Visual Studio Code ESLint extension: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint