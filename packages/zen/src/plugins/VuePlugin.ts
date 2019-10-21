import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';

export default class VuePlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAll(['vue', 'webpack'])) {
      const VueLoaderPlugin = builder.require('vue-loader/lib/plugin');

      builder.config = zen.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.vue$/,
              use: { loader: 'vue-loader', options: zen.createConfig(builder, 'vue', {}) }
            }
          ]
        },
        resolve: {
          alias: {
            vue$: 'vue/dist/vue.esm.js'
          }
        },
        plugins: [new VueLoaderPlugin()]
      });
    }
  }
}
