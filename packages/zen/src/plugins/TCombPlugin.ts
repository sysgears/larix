import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';
import JSRuleFinder from './shared/JSRuleFinder';

export default class TCombPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAll(['tcomb', 'webpack']) && !stack.hasAny('dll')) {
      const jsRuleFinder = new JSRuleFinder(builder);
      const jsRule = jsRuleFinder.findJSRule();
      if (jsRule && !jsRule.use.options.babelrc) {
        jsRule.use = zen.merge(jsRule.use, {
          options: {
            plugins: [['babel-plugin-tcomb']]
          }
        });
      }
    }
  }
}
