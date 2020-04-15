#!/bin/bash -xe

cd "$(dirname "$0")"
cd ..

cd ../contracts && npm run ganache &
sleep 3 &&
npm run test-cli-genMaciKeypair &&
npm run test-cli-genMaciPubkey &&
npm run test-cli-create &&
npm run test-cli-signup
