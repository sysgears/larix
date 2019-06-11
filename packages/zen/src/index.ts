const path = require('path');

// If we run in yarn linked mode, require .pnp manually
path.basename(path.dirname(path.join(__dirname, '/..'))) === 'packages' && require('../../../.pnp').setup();

module.exports = require('./exports');