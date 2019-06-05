#!/usr/bin/env node
const path = require('path');

// If we run in yarn linked mode, require .pnp manually
path.basename(path.dirname(__dirname)) === 'packages' && require('../../.pnp').setup();

require('source-map-support').install();
require('./lib/cli');
