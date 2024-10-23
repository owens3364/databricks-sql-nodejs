# This repository is based on [Databricks SQL Driver for Node.js](https://github.com/databricks/databricks-sql-nodejs) and includes the following changes:

## Version at time of fork: 1.8.4

- Removal of dependency on lz4 and @types/lz4
- Minor changes in testing stubs to support node 20

# Databricks SQL Driver for Node.js

![http://www.apache.org/licenses/LICENSE-2.0.txt](http://img.shields.io/:license-Apache%202-brightgreen.svg)
[![npm](https://img.shields.io/npm/v/@owens3364/databricks-sql-nodejs?color=blue&style=flat)](https://www.npmjs.com/package/@owens3364/databricks-sql-nodejs)

## Description

The Databricks SQL Driver for Node.js is a Javascript driver for applications that connect to Databricks clusters and SQL warehouses. This project is a fork of [Hive Driver](https://github.com/lenchv/hive-driver) which connects via Thrift API.

## Requirements

- Node.js 14 or newer

## Installation

```bash
npm i @owens3364/databricks-sql-nodejs
```

## Usage

[examples/usage.js](examples/usage.js)

```javascript
const { DBSQLClient } = require('@owens3364/databricks-sql-nodejs');

const client = new DBSQLClient();

client
  .connect({
    host: '********.databricks.com',
    path: '/sql/2.0/warehouses/****************',
    token: 'dapi********************************',
  })
  .then(async (client) => {
    const session = await client.openSession();

    const queryOperation = await session.executeStatement('SELECT "Hello, World!"');
    const result = await queryOperation.fetchAll();
    await queryOperation.close();

    console.table(result);

    await session.close();
    await client.close();
  })
  .catch((error) => {
    console.log(error);
  });
```

## Run Tests

### Unit tests

You can run all unit tests, or specify a specific test to run:

```bash
npm test
npm test -- <path/to/file.test.js>
```

### e2e tests

Before running end-to-end tests, create a file named `tests/e2e/utils/config.local.js` and set the Databricks SQL connection info:

```javascript
{
    host: '***.databricks.com',
    path: '/sql/2.0/warehouses/***',
    token: 'dapi***',
    database: ['catalog', 'database'],
}
```

Then run

```bash
npm run e2e
npm run e2e -- <path/to/file.test.js>
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Issues

If you find any issues, feel free to create an issue or send a pull request directly.

## License

[Apache License 2.0](LICENSE)
