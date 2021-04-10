import * as fs from 'fs';
import * as ip from 'ip';
import * as path from 'path';
import * as url from 'url';

import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import { resolveDepType } from '../deps';
import getDllName from '../getDllName';
import upDirs from '../upDirs';
import Zen from '../Zen';

const __WINDOWS__ = /^win/.test(process.platform);

const createPlugins = (builder: Builder, zen: Zen) => {
  const stack = builder.stack;
  const webpack = builder.require('webpack');
  const webpackVer = builder.require('webpack/package.json').version.split('.')[0];
  const buildNodeEnv = process.env.NODE_ENV || (zen.dev ? (zen.test ? 'test' : 'development') : 'production');

  let plugins = [];

  if (zen.dev) {
    if (webpackVer < 4) {
      plugins.push(new webpack.NamedModulesPlugin());
    }
    if (builder.profile) {
      plugins.push(
        new webpack.debug.ProfilingPlugin({
          outputPath: path.join(
            builder.require.cwd,
            stack.hasAny('dll') ? builder.dllBuildDir : builder.buildDir,
            'profileEvents.json'
          )
        })
      );
    }
    if (stack.hasAny(['server', 'web']) && !zen.test && !stack.hasAny('storybook')) {
      plugins.push(new webpack.HotModuleReplacementPlugin());
      if (webpackVer < 4) {
        plugins.push(new webpack.NoEmitOnErrorsPlugin());
      }
    }
  } else {
    if (webpackVer < 4) {
      if (builder.minify) {
        const uglifyOpts: any = { test: /\.(js|bundle)(\?.*)?$/i, cache: true, parallel: true };
        if (builder.sourceMap) {
          uglifyOpts.sourceMap = true;
        }
        if (stack.hasAny('angular')) {
          // https://github.com/angular/angular/issues/10618
          uglifyOpts.uglifyOptions = {
            mangle: {
              // eslint-disable-next-line @typescript-eslint/camelcase
              keep_fnames: true
            }
          };
        }
        const UglifyJsPlugin = builder.require('uglifyjs-webpack-plugin');
        plugins.push(new UglifyJsPlugin(uglifyOpts));
      }
      plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
    }
  }

  const backendOption = builder.backendUrl;
  const defines: any = {};
  if (backendOption) {
    defines.__BACKEND_URL__ = `'${backendOption.replace('{ip}', ip.address())}'`;
  }

  if (builder.require.probe('clean-webpack-plugin')) {
    const CleanWebpackPlugin = builder.require('clean-webpack-plugin');
    plugins = plugins.concat(new CleanWebpackPlugin(builder.buildDir));
  }

  if (stack.hasAny('dll')) {
    const name = getDllName(builder);
    plugins = [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': `"${buildNodeEnv}"`,
        ...defines,
        ...builder.defines
      }),
      new webpack.DllPlugin({
        name,
        path: path.join(builder.dllBuildDir, `${name}_dll.json`)
      })
    ];
  } else {
    if (stack.hasAny('server')) {
      plugins = plugins.concat([
        new webpack.BannerPlugin({
          banner: 'require("source-map-support").install();',
          raw: true,
          entryOnly: false
        }),
        new webpack.DefinePlugin({
          __CLIENT__: false,
          __SERVER__: true,
          __SSR__: builder.ssr && !zen.test,
          __DEV__: zen.dev,
          __TEST__: zen.test,
          'process.env.NODE_ENV': `"${buildNodeEnv}"`,
          ...defines,
          ...builder.defines
        })
      ]);
    } else {
      plugins = plugins.concat([
        new webpack.DefinePlugin({
          __CLIENT__: true,
          __SERVER__: false,
          __SSR__: builder.ssr && !zen.test,
          __DEV__: zen.dev,
          __TEST__: zen.test,
          'process.env.NODE_ENV': `"${buildNodeEnv}"`,
          ...defines,
          ...builder.defines
        })
      ]);

      if (stack.hasAny('web')) {
        const ManifestPlugin = builder.require('webpack-manifest-plugin');
        plugins.push(
          new ManifestPlugin({
            fileName: 'assets.json'
          })
        );

        if (!builder.ssr && !stack.hasAny('storybook')) {
          const HtmlWebpackPlugin = builder.require('html-webpack-plugin');
          let template = builder.htmlTemplate;
          if (!template) {
            const dirs = ['.', 'src'];
            for (const dir of dirs) {
              const htmlPath = path.join(builder.require.cwd, dir, 'index.html');
              if (fs.existsSync(htmlPath)) {
                template = htmlPath;
                break;
              }
            }
          }
          template = template || path.join(__dirname, '../../html-plugin-template.ejs');
          plugins.push(
            new HtmlWebpackPlugin({
              template,
              inject: 'body'
            })
          );
        }

        if (webpackVer < 4 && !zen.dev) {
          plugins.push(
            new webpack.optimize.CommonsChunkPlugin({
              name: 'vendor',
              filename: '[name].[hash].js',
              minChunks(module) {
                return module.resource && module.resource.indexOf(path.join(builder.require.cwd, 'node_modules')) === 0;
              }
            })
          );
        }
      }
    }
  }

  return plugins;
};

const findNodeModulesDirs = (cwd: string) =>
  upDirs(cwd, 'node_modules').reduce((res, dir) => res.concat(fs.existsSync(dir) ? [dir] : []), []);

const findNodeModule = (name, nodeModulesDirs) => {
  for (const dir of nodeModulesDirs) {
    const packageDir = path.join(dir, name);
    if (fs.existsSync(path.join(packageDir, 'package.json'))) {
      return packageDir;
    }
  }
};

const getDepsForNode = (zen: Zen, builder: Builder): string[] => {
  const nodeModulesDirs = findNodeModulesDirs(builder.require.cwd);
  const pkg = builder.require('./package.json');
  const deps = [];
  for (const key of Object.keys(pkg.dependencies)) {
    const val = builder.depPlatforms[key];
    let excluded = false;
    for (const regexp of builder.dllExcludes) {
      if (new RegExp(regexp).test(key)) {
        excluded = true;
      }
    }
    if (
      !excluded &&
      key.indexOf('@types') !== 0 &&
      (!val || (val.constructor === Array && val.indexOf(builder.parent.name) >= 0) || val === builder.parent.name)
    ) {
      const moduleDir = findNodeModule(key, nodeModulesDirs);
      if (moduleDir && !fs.lstatSync(moduleDir).isSymbolicLink()) {
        const resolves = builder.require.probe(key);
        if (resolves && resolves.endsWith('.js')) {
          deps.push(key);
        }
      } else if (!moduleDir) {
        throw new Error(`Cannot find module '${key}'`);
      }
    }
  }
  return deps;
};

let curWebpackDevPort = 3000;
const webpackPortMap = {};

const createConfig = (builder: Builder, zen: Zen) => {
  const stack = builder.stack;

  const cwd = process.cwd();

  const webpackVer = builder.require('webpack/package.json').version.split('.')[0];

  const baseConfig: any = {
    name: builder.name,
    module: {
      rules: [
        webpackVer >= 4
          ? {
              test: /\.mjs$/,
              include: /node_modules/,
              type: 'javascript/auto'
            }
          : {
              test: /\.mjs$/,
              include: /node_modules/
            }
      ]
    },
    resolve: { symlinks: false, cacheWithContext: false },
    watchOptions: {
      ignored: new RegExp(builder.buildDir)
    },
    bail: !zen.dev,
    stats: {
      hash: false,
      version: false,
      timings: true,
      assets: false,
      chunks: false,
      modules: false,
      reasons: false,
      children: false,
      source: true,
      errors: true,
      errorDetails: true,
      warnings: true,
      publicPath: false,
      colors: true
    },
    output: {}
  };

  if (builder.sourceMap) {
    baseConfig.devtool = zen.dev ? '#cheap-module-source-map' : '#nosources-source-map';
    baseConfig.output.devtoolModuleFilenameTemplate = zen.dev
      ? info =>
          'webpack:///./' +
          path
            .relative(
              cwd,
              resolveDepType(info.absoluteResourcePath.split('?')[0], builder.projectRoot, builder.require).realPath
            )
            .replace(/\\/g, '/')
      : info =>
          path.relative(cwd, resolveDepType(info.absoluteResourcePath, builder.projectRoot, builder.require).realPath);
  }
  if (webpackVer >= 4) {
    baseConfig.mode = !zen.dev ? 'production' : 'development';
    baseConfig.performance = { hints: false };
    baseConfig.output.pathinfo = false;
  }

  const baseDevServerConfig = {
    hot: true,
    publicPath: '/',
    headers: { 'Access-Control-Allow-Origin': '*' },
    open: builder.openBrowser !== false,
    quiet: false,
    noInfo: true,
    historyApiFallback: true
  };

  const plugins = createPlugins(builder, zen);
  let config = {
    ...baseConfig,
    plugins
  };

  if (stack.hasAny('server')) {
    config = {
      ...config,
      target: 'node',
      externals: (context, request, callback) => {
        if (
          request.indexOf('webpack') < 0 &&
          request.indexOf('mochapack') < 0 &&
          request.indexOf('mocha-webpack') < 0 &&
          !request.startsWith('.') &&
          !request.startsWith('!')
        ) {
          const fullPath = builder.require.probe(request, context);
          if (fullPath) {
            const ext = path.extname(fullPath);
            if (fullPath.indexOf('node_modules') >= 0 && ['.js', '.jsx', '.json'].indexOf(ext) >= 0) {
              return callback(null, 'commonjs ' + request);
            }
          }
        }
        return callback();
      }
    };
    if (builder.sourceMap) {
      config.output.devtoolModuleFilenameTemplate = (info: any) => {
        const modPath = path.relative(
          config.output.path,
          resolveDepType(info.absoluteResourcePath, builder.projectRoot, builder.require).realPath
        );
        return modPath;
      };
    }
  } else {
    config = {
      ...config,
      node: {
        __dirname: true,
        __filename: true,
        fs: 'empty',
        net: 'empty',
        tls: 'empty'
      }
    };
  }

  if (webpackVer >= 4) {
    if (zen.dev) {
      config = {
        ...config,
        optimization: {
          removeAvailableModules: false,
          removeEmptyChunks: false,
          splitChunks: false
        }
      };
    } else {
      config = {
        ...config,
        optimization: {
          minimize: builder.minify,
          concatenateModules: builder.minify,
          namedModules: true,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          noEmitOnErrors: true
        }
      };
      const TerserPlugin = builder.require('terser-webpack-plugin');
      const terserOptions: any = {};
      if (stack.hasAny('angular')) {
        // eslint-disable-next-line @typescript-eslint/camelcase
        terserOptions.keep_fnames = true;
      }
      config.optimization.minimizer = [
        new TerserPlugin({
          test: /\.(js|bundle)(\?.*)?$/i,
          cache: true,
          parallel: true,
          sourceMap: builder.sourceMap,
          terserOptions: zen.createConfig(builder, 'terser', terserOptions)
        })
      ];
    }
  }

  if (stack.hasAny('dll')) {
    const name = getDllName(builder);
    config = {
      ...config,
      entry: {
        vendor: getDepsForNode(zen, builder)
      },
      output: {
        ...config.output,
        filename: `${name}_[hash]_dll.js`,
        path: path.join(builder.require.cwd, builder.dllBuildDir),
        library: name
      },
      bail: true
    };
    if (stack.hasAny('web')) {
      config.entry.vendor.push('webpack-dev-server/client');
    }
    if (builder.sourceMap) {
      config.devtool = zen.dev ? '#cheap-module-source-map' : '#nosources-source-map';
    }
  } else {
    if (zen.dev) {
      config.module.unsafeCache = false;
      config.resolve.unsafeCache = false;
    }
    if (stack.hasAny('server')) {
      const index = [];
      if (zen.dev && !zen.test) {
        if (__WINDOWS__) {
          index.push('webpack/hot/poll?1000');
        } else {
          index.push('webpack/hot/signal.js');
        }
      }
      index.push(builder.entry || './src/server/index.js');

      config = {
        ...config,
        entry: {
          index
        },
        output: {
          ...config.output,
          filename: '[name].js',
          path: path.join(builder.require.cwd, builder.buildDir || builder.backendBuildDir || 'build/server'),
          publicPath: '/'
        },
        node: {
          __dirname: true,
          __filename: true
        }
      };
      if (builder.sourceMap && zen.dev) {
        // TODO: rollout proper source map handling during Webpack HMR on a server code
        // Use that to improve situation with source maps of hot reloaded server code
        config.output.sourceMapFilename = '[name].[chunkhash].js.map';
      }
    } else if (stack.hasAny('web')) {
      let webpackDevPort;
      if (!builder.webpackDevPort) {
        if (!webpackPortMap[builder.name]) {
          webpackPortMap[builder.name] = curWebpackDevPort++;
        }
        webpackDevPort = webpackPortMap[builder.name];
      } else {
        webpackDevPort = builder.webpackDevPort;
      }

      config = {
        ...config,
        entry: {
          index: [builder.entry || './src/client/index.js']
        },
        output: {
          ...config.output,
          filename: '[name].[hash].js',
          chunkFilename: '[name].[chunkhash].js',
          path: builder.buildDir
            ? path.join(builder.require.cwd, builder.buildDir)
            : path.join(builder.require.cwd, builder.frontendBuildDir || 'build/client', 'web'),
          publicPath: '/'
        },
        devServer: {
          ...baseDevServerConfig,
          port: webpackDevPort
        }
      };
      if (builder.devProxy) {
        const proxyUrl =
          typeof builder.devProxy === 'string'
            ? builder.devProxy
            : builder.backendUrl
            ? `http://localhost:${url.parse(builder.backendUrl).port}`
            : `http://localhost:8080`;
        config.devServer.proxy = {
          '!(/sockjs-node/**/*|/*.hot-update.{json,js})': {
            target: proxyUrl,
            logLevel: 'info',
            ws: true
          }
        };
      }
      if (webpackVer >= 4 && !zen.dev) {
        config.optimization.splitChunks = {
          cacheGroups: {
            commons: {
              test: /[\\/]node_modules[\\/].*\.(js|mjs|ejs)$/,
              name: 'vendor',
              chunks: 'all'
            },
            styles: {
              name: 'index',
              test: /\.(css|sass|less|scss)$/,
              chunks: 'all',
              enforce: true
            }
          }
        };
      }
    } else if (stack.hasAny('react-native')) {
      config = {
        ...config,
        entry: {
          index: [builder.entry || './src/mobile/index.js']
        },
        output: {
          ...config.output,
          filename: `index.mobile.bundle`,
          publicPath: '/',
          path: builder.buildDir
            ? path.join(builder.require.cwd, builder.buildDir)
            : path.join(builder.require.cwd, builder.frontendBuildDir || 'build/client', builder.name)
        },
        devServer: {
          ...baseDevServerConfig,
          hot: false,
          port: stack.hasAny('android') ? 3010 : 3020
        }
      };
    } else {
      throw new Error(`Unknown platform target: ${stack.platform}`);
    }
  }

  return config;
};

export default class WebpackPlugin implements ConfigPlugin {
  public configure(builder: Builder, zen: Zen) {
    const stack = builder.stack;

    if (stack.hasAny('webpack')) {
      builder.config = builder.config || {};
      builder.config = zen.merge(builder.config, createConfig(builder, zen));
    }
  }
}
