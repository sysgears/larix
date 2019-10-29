/* eslint-disable import/no-extraneous-dependencies */
const crypto = require('crypto');
const metroTransformer = require('metro-react-native-babel-transformer');
const jestTransformI18next = require('./jest-transform-i18next');

const transform = ({ src, filename, options }) => {
  let result = src;
  if (/locales[\\/]index\.([jt]s)$/.test(filename)) {
    result = jestTransformI18next.process(null, filename).code;
  }

  const babelCompileResult = metroTransformer.transform({
    src: result,
    filename,
    options
  });

  return babelCompileResult;
};

const cacheKeyParts = [
  process.env.API_URL,
  process.env.WEBSITE_URL,
  metroTransformer.getCacheKey()
];

function getCacheKey() {
  const key = crypto.createHash('md5');
  cacheKeyParts.forEach(part => key.update(String(part)));
  return key.digest('hex');
}

module.exports = { transform, getCacheKey };
