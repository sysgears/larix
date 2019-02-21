import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';

export default class ReactNativeWebPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAll(['react-native-web', 'webpack']) && stack.hasAny(['server', 'web'])) {
      builder.config = zen.merge(builder.config, {
        resolve: {
          alias: {
            'react-native': 'react-native-web'
          }
        }
      });

      if (stack.hasAny('server')) {
        const originalExternals = builder.config.externals;
        builder.config.externals = (context, request, callback) => {
          if (request.indexOf('react-native') >= 0) {
            return callback(null, 'commonjs ' + request + '-web');
          } else {
            return originalExternals(context, request, callback);
          }
        };
      }
    }
  }
}
