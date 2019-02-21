import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Zen from '../Zen';

export default class WebAssetsPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (
      !stack.hasAny('dll') &&
      (stack.hasAll(['webpack', 'web']) || (stack.hasAll(['webpack', 'server']) && builder.ssr))
    ) {
      builder.config = zen.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.(png|ico|jpg|gif|xml)$/,
              use: {
                loader: 'url-loader',
                options: zen.createConfig(builder, 'url', {
                  name: '[hash].[ext]',
                  limit: 100000
                })
              }
            },
            {
              test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: 'url-loader',
                options: zen.createConfig(builder, 'url', {
                  name: '[hash].[ext]',
                  limit: 100000
                })
              }
            },
            {
              test: /\.(otf|ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: 'file-loader',
                options: zen.createConfig(builder, 'file', {
                  name: '[hash].[ext]'
                })
              }
            }
          ]
        }
      });
    } else if (!stack.hasAny('dll') && stack.hasAll(['webpack', 'server']) && !builder.ssr) {
      const ignoreLoader = 'ignore-loader';
      builder.config = zen.merge(builder.config, {
        module: {
          rules: [
            {
              test: /\.(png|ico|jpg|xml)$/,
              use: {
                loader: ignoreLoader
              }
            },
            {
              test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: ignoreLoader
              }
            },
            {
              test: /\.(otf|ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
              use: {
                loader: ignoreLoader
              }
            }
          ]
        }
      });
    }
  }
}
