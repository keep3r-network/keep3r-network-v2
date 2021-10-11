#!/bin/sh

OUTPUT_DIR="docs/technical"

# clean output directory
rm -rf $OUTPUT_DIR

# generate docs
yarn solidity-docgen -i solidity -o $OUTPUT_DIR --solc-module solc-0.8

# leave only docs/interfaces files in docs directory
rm -rf $OUTPUT_DIR/for-test $OUTPUT_DIR/contracts
mv $OUTPUT_DIR/interfaces/* $OUTPUT_DIR
rm -rf $OUTPUT_DIR/interfaces

# set directory title
echo "# Technical" > $OUTPUT_DIR/README.md