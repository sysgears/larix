const config = {
  //{#isWorkspace//}
  ...require('../../build.config'),
  //{/isWorkspace//}
  'process.env.NODE_ENV': process.env.NODE_ENV
};

module.exports = config;
