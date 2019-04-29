import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';

export default class I18NextPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAll(['i18next', 'webpack'])) {
      builder.config = zen.merge(builder.config, {
        module: {
          rules: [
            {
              test: /locales/,
              use: { loader: '@alienfast/i18next-loader', options: zen.createConfig(builder, 'i18next', {}) }
            }
          ]
        }
      });
    }
  }
}
