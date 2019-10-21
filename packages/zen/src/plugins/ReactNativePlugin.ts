import * as fs from 'fs';
import * as path from 'path';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import { ModuleType, resolveDepType } from '../deps';
import Zen from '../Zen';
import JSRuleFinder from './shared/JSRuleFinder';
import UPFinder from './shared/UPFinder';

let babelRegisterDone = false;

const registerBabel = (builder: Builder): void => {
  if (!babelRegisterDone) {
    const babelPkgJson = builder.require.probe('babel-core') && builder.require('babel-core/package.json');
    const isBabel7 =
      builder.require.probe('@babel/core') && (!babelPkgJson || babelPkgJson.version.indexOf('bridge') >= 0);
    const babelRegister = isBabel7 ? '@babel/register' : 'babel-register';
    const reactNativePreset =
      isBabel7 && builder.require.probe('metro-react-native-babel-preset')
        ? 'metro-react-native-babel-preset'
        : 'babel-preset-react-native';
    builder.require(babelRegister)({
      presets: [
        builder.require.resolve(reactNativePreset),
        builder.require.resolve(isBabel7 ? '@babel/preset-flow' : 'babel-preset-flow')
      ],
      ignore: [/.*[/\\]node_modules[/\\](?!haul|react-native)/],
      retainLines: true,
      sourceMaps: 'inline'
    });
    builder.require('babel-polyfill');

    babelRegisterDone = true;
  }
};

export default class ReactNativePlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAll(['react-native', 'webpack'])) {
      registerBabel(builder);

      const webpack = builder.require('webpack');

      const mobileAssetTest = /\.(bmp|gif|jpg|jpeg|png|psd|svg|webp|m4v|aac|aiff|caf|m4a|mp3|wav|html|pdf|ttf|otf)$/;

      const AssetResolver = builder.require('haul/src/resolvers/AssetResolver');
      const HasteResolver = builder.require('haul/src/resolvers/HasteResolver');

      const babelrc = new UPFinder(builder).find(['.babelrc.native', 'babel.config.native.js']);

      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findJSRule();
      if (jsRule) {
        jsRule.exclude = modulePath => {
          const moduleType = resolveDepType(modulePath, builder.projectRoot, builder.require).moduleType;
          const result = moduleType === ModuleType.NormalNodeModule || moduleType === ModuleType.TranspiledNodeModule;
          return result;
        };
      }
      const cacheDirectory =
        builder.cache === false || (builder.cache === 'auto' && !zen.dev)
          ? false
          : path.join(
              builder.cache === true || (builder.cache === 'auto' && zen.dev) ? '.cache' : builder.cache,
              'babel-loader'
            );
      const babelPkgJson = builder.require.probe('babel-core') && builder.require('babel-core/package.json');
      const isBabel7 =
        builder.require.probe('@babel/core') && (!babelPkgJson || babelPkgJson.version.indexOf('bridge') >= 0);
      const reactNativePreset =
        isBabel7 && builder.require.probe('metro-react-native-babel-preset')
          ? 'module:metro-react-native-babel-preset'
          : 'react-native';
      const defaultConfig = babelrc
        ? JSON.parse(fs.readFileSync(babelrc).toString())
        : {
            compact: !zen.dev,
            presets: [reactNativePreset] as any[],
            plugins: ['haul/src/utils/fixRequireIssues']
          };
      const babelOptions = zen.createConfig(builder, 'babel', {
        babelrc: false,
        configFile: false,
        cacheDirectory,
        ...defaultConfig
      });
      builder.config.module.rules.push({
        test: /\.[jt]s$/,
        exclude: modulePath => {
          const result =
            resolveDepType(modulePath, builder.projectRoot, builder.require).moduleType !==
            ModuleType.TranspiledNodeModule;
          return result;
        },
        use: {
          loader: builder.require.probe('heroku-babel-loader') ? 'heroku-babel-loader' : 'babel-loader',
          options: babelOptions
        }
      });

      builder.config.resolve.extensions = [`.${stack.platform}.`, '.native.', '.']
        .map(prefix => jsRuleFinder.extensions.map(ext => prefix + ext))
        .reduce((acc, val) => acc.concat(val))
        .concat(['.json']);

      const reactVer = builder.require('react-native/package.json').version.split('.')[1] >= 43 ? 16 : 15;
      const polyfillCode = fs
        .readFileSync(require.resolve(`./react-native/polyfills/react-native-polyfill-${reactVer}`))
        .toString();
      const VirtualModules = builder.require('webpack-virtual-modules');
      builder.config = zen.merge(builder.config, {
        module: {
          rules: [
            { parser: { requireEnsure: false } },
            {
              test: mobileAssetTest,
              use: {
                loader: '@larix/zen/lib/plugins/react-native/assetLoader',
                options: zen.createConfig(builder, 'asset', {
                  platform: stack.platform,
                  root: builder.require.cwd,
                  cwd: builder.require.cwd,
                  bundle: false
                })
              }
            }
          ]
        },
        resolve: {
          plugins: [
            new HasteResolver({
              directories: [path.join(path.dirname(builder.require.resolve('react-native/package.json')), 'Libraries')]
            }),
            new AssetResolver({
              platform: stack.platform,
              test: mobileAssetTest
            })
          ],
          mainFields: ['react-native', 'browser', 'main']
        },
        plugins: [new VirtualModules({ 'node_modules/@virtual/react-native-polyfill.js': polyfillCode })],
        target: 'webworker'
      });

      if (stack.hasAny('dll')) {
        builder.config = zen.merge(builder.config, {
          entry: {
            vendor: ['@virtual/react-native-polyfill']
          }
        });
      } else {
        const idx = builder.config.entry.index.indexOf('babel-polyfill');
        if (idx >= 0) {
          builder.config.entry.index.splice(idx, 1);
        }
        builder.config = zen.merge(
          {
            plugins: builder.sourceMap
              ? [
                  new webpack.SourceMapDevToolPlugin({
                    test: new RegExp(`\\.bundle$`),
                    filename: '[file].map'
                  })
                ]
              : [],
            entry: {
              index: ['@virtual/react-native-polyfill']
            }
          },
          builder.config
        );
      }
    }
  }
}
