# Useful commands

### Tests

```sh
$ npx hardhat test
$ npx hardhat test test/staking.test.ts --show-stack-traces
```

### Locale node

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

## Verify on etherscun
npx hardhat verify --contract contracts/PromoStaking.sol --network ethereum <contract address>

```

### Prettier and linter

```sh
$ npm run eslint
$ npm run prettier
$ npx prettier --write 'contracts/**/*.sol'
```

# Useful plugins and extensions

* Visual Studio Code ESLint extension: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint