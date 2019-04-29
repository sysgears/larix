import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';
import JSRuleFinder from './shared/JSRuleFinder';

export default class ReactHotLoaderPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAll(['react-hot-loader', 'webpack'])) {
      if (zen.dev && !zen.test && !stack.hasAny('dll')) {
        builder.config = zen.mergeWithStrategy(
          {
            entry: 'prepend'
          },
          builder.config,
          {
            entry: {
              index: ['react-hot-loader/patch']
            }
          }
        );
        const jsRuleFinder = new JSRuleFinder(builder);
        const jsRule = jsRuleFinder.findAndCreateJSRule();
        const tsRule = jsRuleFinder.findTSRule();
        const isBabelUsed = jsRule.use.loader && jsRule.use.loader.indexOf('babel') >= 0;
        if (isBabelUsed) {
          jsRule.use = zen.merge(jsRule.use, {
            options: {
              plugins: ['react-hot-loader/babel']
            }
          });
        } else {
          jsRule.use.loader = ['react-hot-loader/webpack'].concat(jsRule.use.loader);
        }
        if (tsRule) {
          tsRule.use.unshift({ loader: 'react-hot-loader/webpack' });
        }
      }

      builder.config.module.rules.push({
        test: /\.js$/,
        include: /node_modules/,
        use: {
          loader: 'react-hot-loader/webpack'
        }
      });
    }
  }
}
