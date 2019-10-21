import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';
import JSRuleFinder from './shared/JSRuleFinder';
import UPFinder from './shared/UPFinder';

export default class BabelPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    if (
      builder.stack.hasAny(['babel', 'es6']) &&
      builder.stack.hasAll(['webpack']) &&
      (!builder.stack.hasAny('dll') || builder.stack.hasAny(['android', 'ios']))
    ) {
      if (builder.stack.hasAny(['babel', 'es6']) && !builder.stack.hasAny('dll')) {
        const babelPkgJson = builder.require.probe('babel-core') && builder.require('babel-core/package.json');
        const isBabel7 =
          builder.require.probe('@babel/core') && (!babelPkgJson || babelPkgJson.version.indexOf('bridge') >= 0);
        builder.config = zen.merge(
          {
            entry: {
              index: [isBabel7 ? '@babel/polyfill' : 'babel-polyfill']
            }
          },
          builder.config
        );
      }

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findAndCreateJSRule();
      const cacheDirectory =
        builder.cache === false || (builder.cache === 'auto' && !zen.dev)
          ? false
          : path.join(
              builder.cache === true || (builder.cache === 'auto' && zen.dev) ? '.cache' : builder.cache,
              'babel-loader'
            );
      const babelrc = new UPFinder(builder).find(['.babelrc', '.babelrc.js', 'babel.config.js']);
      jsRule.use = {
        loader: builder.require.probe('heroku-babel-loader') ? 'heroku-babel-loader' : 'babel-loader',
        options: babelrc
          ? { babelrc: true, cacheDirectory, rootMode: 'upward-optional' }
          : zen.createConfig(builder, 'babel', {
              babelrc: false,
              cacheDirectory,
              compact: !zen.dev,
              presets: (['react', ['env', { modules: false }], 'stage-0'] as any[]).concat(
                zen.dev ? [] : [['minify', { mangle: false }]]
              ),
              plugins: ['transform-runtime', 'transform-decorators-legacy', 'transform-class-properties'],
              only: jsRuleFinder.extensions.map(ext => '*.' + ext)
            })
      };
    }
  }
}
