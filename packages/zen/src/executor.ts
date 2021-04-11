import { exec, spawn } from 'child_process';
import cluster from 'cluster';
import * as cors from 'connect-cors';
import { createHash } from 'crypto';
import Debug from 'debug';
import * as detectPort from 'detect-port';
import * as fs from 'fs';
import * as http from 'http';
import * as ip from 'ip';
import * as isDocker from 'is-docker';
import * as _ from 'lodash';
import minilog from 'minilog';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as serveStatic from 'serve-static';
import { fromStringWithSourceMap, SourceListMap } from 'source-list-map';
import * as url from 'url';
import { ConcatSource, RawSource } from 'webpack-sources';

import { Builder, Builders } from './Builder';
import getDllName from './getDllName';
import liveReloadMiddleware from './plugins/react-native/liveReloadMiddleware';
import symbolicateMiddleware from './plugins/react-native/symbolicateMiddleware';
import { hookAsync, hookSync } from './webpackHooks';
import Zen from './Zen';

const LARIX_DLL_VERSION = 3;
const BACKEND_CHANGE_MSG = 'backend_change';

const debug = Debug('zen');
const expoPorts = {};

const clientStats = { all: false, assets: true, warnings: true, errors: true, errorDetails: false };

const zenLogger = minilog('zen');

process.on('uncaughtException', ex => {
  zenLogger.error(ex);
});

process.on('unhandledRejection', reason => {
  zenLogger.error(reason);
});

const __WINDOWS__ = /^win/.test(process.platform);

let server;
let startBackend = false;
let lastExitCode = 0;
let nodeDebugOpt;

process.on('exit', () => {
  if (server) {
    server.kill('SIGTERM');
  }
});

const spawnServer = (cwd, args: any[], options: { nodeDebugger: boolean; serverPath: string }, logger) => {
  server = spawn('node', [...args], {
    stdio: [0, 1, 2],
    cwd,
    env: { ...process.env, LAST_EXIT_CODE: `${lastExitCode}` }
  });
  logger.info(`Spawning ${['node', ...args].join(' ')}, env: { LAST_EXIT_CODE: ${lastExitCode} }`);
  server.on('exit', code => {
    lastExitCode = code;
    if (code === 250) {
      // App requested full reload
      startBackend = true;
    }
    logger.info(`Backend stopped, exit code:`, code);
    server = undefined;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    runServer(cwd, options.serverPath, options.nodeDebugger, logger);
  });
};

const runServer = (cwd, serverPath, nodeDebugger, logger) => {
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Backend doesn't exist at ${serverPath}, exiting`);
  }
  if (startBackend) {
    startBackend = false;
    logger.debug('Starting backend');

    if (!nodeDebugOpt) {
      if (!nodeDebugger) {
        // disables node debugger when the option was set to false
        spawnServer(cwd, [serverPath], { serverPath, nodeDebugger }, logger);
      } else {
        exec('node -v', (error, stdout, stderr) => {
          if (error) {
            zenLogger.error(error);
            process.exit(1);
          }
          const nodeVersion = stdout.match(/^v([0-9]+)\.([0-9]+)\.([0-9]+)/);
          const nodeMajor = parseInt(nodeVersion[1], 10);
          const nodeMinor = parseInt(nodeVersion[2], 10);
          nodeDebugOpt = nodeMajor >= 6 || (nodeMajor === 6 && nodeMinor >= 9) ? '--inspect' : '--debug';
          detectPort(9229).then(debugPort => {
            // Bind the port to public ip in order to allow users to access the port for debugging when using docker.
            const debugHost = isDocker() ? '0.0.0.0:' : '';
            spawnServer(
              cwd,
              [nodeDebugOpt + '=' + debugHost + debugPort, serverPath],
              { serverPath, nodeDebugger },
              logger
            );
          });
        });
      }
    } else {
      spawnServer(cwd, [nodeDebugOpt, serverPath], { serverPath, nodeDebugger }, logger);
    }
  }
};

const webpackReporter = (zen: Zen, builder: Builder, outputPath: string, log, err?, stats?) => {
  if (err) {
    log.error(err.stack);
    throw new Error('Build error');
  }
  if (stats) {
    const str = stats.toString(builder.config.stats);
    if (str.length > 0) {
      log.info(str);
    }

    if (builder.writeStats) {
      mkdirp.sync(outputPath);
      fs.writeFileSync(path.join(outputPath, 'stats.json'), JSON.stringify(stats.toJson(clientStats)));
    }
  }
  if (!zen.watch && cluster.isWorker) {
    const exitCode = stats.compilation.errors && stats.compilation.errors.length ? 1 : 0;
    log.info(`Build process finished, exit code: ${exitCode}`);
    process.exit(exitCode);
  }
};

const frontendVirtualModules = [];

class MobileAssetsPlugin {
  public vendorAssets: any;

  constructor(vendorAssets?) {
    this.vendorAssets = vendorAssets || [];
  }

  public apply(compiler) {
    hookAsync(compiler, 'after-compile', (compilation, callback) => {
      compilation.chunks.forEach(chunk => {
        chunk.files.forEach(file => {
          if (file.endsWith('.bundle')) {
            const assets = this.vendorAssets;
            compilation.modules.forEach(module => {
              if (module._asset) {
                assets.push(module._asset);
              }
            });
            compilation.assets[file.replace('.bundle', '') + '.assets'] = new RawSource(JSON.stringify(assets));
          }
        });
      });
      callback();
    });
  }
}

const reactNativeImpl = {
  community: {
    messageSocket: '@react-native-community/cli/build/commands/server/messageSocket',
    webSocketProxy: '@react-native-community/cli/build/commands/server/webSocketProxy',
    inspectorProxy: undefined,
    copyToClipBoardMiddleware: '@react-native-community/cli/build/commands/server/middleware/copyToClipBoardMiddleware',
    cpuProfilerMiddleware: undefined,
    getDevToolsMiddleware: '@react-native-community/cli/build/commands/server/middleware/getDevToolsMiddleware',
    heapCaptureMiddleware: undefined,
    indexPageMiddleware: '@react-native-community/cli/build/commands/server/middleware/indexPage',
    loadRawBodyMiddleware: '@react-native-community/cli/build/commands/server/middleware/loadRawBodyMiddleware',
    openStackFrameInEditorMiddleware:
      '@react-native-community/cli/build/commands/server/middleware/openStackFrameInEditorMiddleware',
    statusPageMiddleware: '@react-native-community/cli/build/commands/server/middleware/statusPageMiddleware',
    systraceProfileMiddleware: '@react-native-community/cli/build/commands/server/middleware/systraceProfileMiddleware',
    unless: '@react-native-community/cli/build/commands/server/middleware/unless'
  },
  original: {
    messageSocket: 'react-native/local-cli/server/util/messageSocket',
    webSocketProxy: 'react-native/local-cli/server/util/webSocketProxy',
    inspectorProxy: 'react-native/local-cli/server/util/inspectorProxy',
    copyToClipBoardMiddleware: 'react-native/local-cli/server/middleware/copyToClipBoardMiddleware',
    cpuProfilerMiddleware: 'react-native/local-cli/server/middleware/cpuProfilerMiddleware',
    getDevToolsMiddleware: 'react-native/local-cli/server/middleware/getDevToolsMiddleware',
    heapCaptureMiddleware: 'react-native/local-cli/server/middleware/heapCaptureMiddleware',
    indexPageMiddleware: 'react-native/local-cli/server/middleware/indexPage',
    loadRawBodyMiddleware: 'react-native/local-cli/server/middleware/loadRawBodyMiddleware',
    openStackFrameInEditorMiddleware: 'react-native/local-cli/server/middleware/openStackFrameInEditorMiddleware',
    statusPageMiddleware: 'react-native/local-cli/server/middleware/statusPageMiddleware',
    systraceProfileMiddleware: 'react-native/local-cli/server/middleware/systraceProfileMiddleware',
    unless: 'react-native/local-cli/server/middleware/unless'
  }
};

const debugMiddleware = (req, res, next) => {
  if (['/debug', '/debug/bundles'].indexOf(req.path) >= 0) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><div><a href="/debug/bundles">Cached Bundles</a></div>');
  } else {
    next();
  }
};

const startReactNativeServer = async (builder: Builder, zen: Zen, logger, applyMiddleware: (app) => void) => {
  let wsProxy;
  let ms;
  let inspectorProxy;

  const connect = builder.require('connect');
  const compression = builder.require('compression');
  const httpProxyMiddleware = builder.require('http-proxy-middleware');
  const mime = builder.require('mime', builder.require.resolve('webpack-dev-middleware'));

  const app = connect();

  const serverInstance = http.createServer(app);
  mime.define({ 'application/javascript': ['bundle'] }, true);
  mime.define({ 'application/json': ['assets'] }, true);

  const isOriginal = builder.require.probe(reactNativeImpl.original.messageSocket);
  const rnRequire = isOriginal ? builder.require : name => builder.require(name).default;
  const rnImpl = isOriginal ? reactNativeImpl.original : reactNativeImpl.community;

  const messageSocket = rnRequire(rnImpl.messageSocket);
  const webSocketProxy = rnRequire(rnImpl.webSocketProxy);

  try {
    if (rnImpl.inspectorProxy) {
      const InspectorProxy = rnRequire(rnImpl.inspectorProxy);
      inspectorProxy = new InspectorProxy();
    }
  } catch (ignored) {
    // continue, regardless of error
  }
  const copyToClipBoardMiddleware = rnRequire(rnImpl.copyToClipBoardMiddleware);
  let cpuProfilerMiddleware;
  try {
    if (rnImpl.cpuProfilerMiddleware) {
      cpuProfilerMiddleware = rnRequire(rnImpl.cpuProfilerMiddleware);
    }
  } catch (ignored) {
    // continue, regardless of error
  }
  const getDevToolsMiddleware = rnRequire(rnImpl.getDevToolsMiddleware);
  let heapCaptureMiddleware;
  try {
    if (rnImpl.heapCaptureMiddleware) {
      heapCaptureMiddleware = rnRequire(rnImpl.heapCaptureMiddleware);
    }
  } catch (ignored) {
    // continue, regardless of error
  }
  const indexPageMiddleware = rnRequire(rnImpl.indexPageMiddleware);
  const loadRawBodyMiddleware = rnRequire(rnImpl.loadRawBodyMiddleware);
  const openStackFrameInEditorMiddleware = rnRequire(rnImpl.openStackFrameInEditorMiddleware);
  const statusPageMiddleware = rnRequire(rnImpl.statusPageMiddleware);
  const systraceProfileMiddleware = rnRequire(rnImpl.systraceProfileMiddleware);
  const unless = rnRequire(rnImpl.unless);

  const args = {
    port: builder.config.devServer.port,
    projectRoots: [path.resolve('.')]
  };
  app
    .use(cors())
    .use(loadRawBodyMiddleware)
    .use((req, res, next) => {
      req.path = req.url.split('?')[0];
      if (req.path === '/symbolicate') {
        req.rawBody = req.rawBody.replace(/index\.mobile\.delta/g, 'index.mobile.bundle');
      }
      const origWriteHead = res.writeHead;
      res.writeHead = (...parms) => {
        const code = parms[0];
        if (code === 404) {
          logger.error(`404 at URL ${req.url}`);
        }
        origWriteHead.apply(res, parms);
      };
      if (req.path !== '/onchange') {
        if (!zen.dev) {
          logger.debug(`Prod mobile packager request: http://localhost:${builder.config.devServer.port}${req.url}`);
        } else if (debug.enabled) {
          logger.debug(`Dev mobile packager request: ${debug.enabled ? req.url : req.path}`);
        }
      }
      next();
    })
    .use(compression());
  app.use('/assets', serveStatic(path.join(builder.require.cwd, '.expo', builder.stack.platform)));
  if (builder.child) {
    app.use(serveStatic(builder.child.config.output.path));
  }
  app
    .use((req, res, next) => {
      if (req.path === '/debugger-ui/deltaUrlToBlobUrl.js') {
        debug(`serving monkey patched deltaUrlToBlobUrl`);
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(`window.deltaUrlToBlobUrl = function(url) { return url.replace('.delta', '.bundle'); }`);
      } else {
        next();
      }
    })
    .use(
      '/debugger-ui',
      serveStatic(
        isOriginal
          ? path.join(
              path.dirname(builder.require.resolve('react-native/package.json')),
              '/local-cli/server/util/debugger-ui'
            )
          : path.join(
              path.dirname(builder.require.resolve('@react-native-community/cli/package.json')),
              '/build/commands/server/debugger-ui'
            )
      )
    )
    .use(getDevToolsMiddleware(args, () => wsProxy && wsProxy.isChromeConnected()))
    .use(getDevToolsMiddleware(args, () => ms && ms.isChromeConnected()));

  app
    .use(openStackFrameInEditorMiddleware(args))
    .use(copyToClipBoardMiddleware)
    .use(statusPageMiddleware)
    .use(systraceProfileMiddleware)
    .use(indexPageMiddleware)
    .use(debugMiddleware);
  if (heapCaptureMiddleware) {
    app.use(heapCaptureMiddleware);
  }
  if (cpuProfilerMiddleware) {
    app.use(cpuProfilerMiddleware);
  }
  if (inspectorProxy) {
    app.use(unless('/inspector', inspectorProxy.processRequest.bind(inspectorProxy)));
  }

  app.use((req, res, next) => {
    if (builder.stack.platform !== 'web') {
      // Workaround for Expo Client bug in parsing Content-Type header with charset
      const origSetHeader = res.setHeader;
      res.setHeader = (key, value) => {
        let val = value;
        if (key === 'Content-Type' && value.indexOf('application/javascript') >= 0) {
          val = value.split(';')[0];
        }
        origSetHeader.call(res, key, val);
      };
    }
    next();
  });
  applyMiddleware(app);

  if (builder.config.devServer.proxy) {
    Object.keys(builder.config.devServer.proxy).forEach(key => {
      app.use(httpProxyMiddleware(key, builder.config.devServer.proxy[key]));
    });
  }

  serverInstance.timeout = 0;
  serverInstance.keepAliveTimeout = 0;

  return new Promise(resolve =>
    serverInstance.listen(builder.config.devServer.port, () => {
      if (builder.platform !== 'web') {
        wsProxy = webSocketProxy.attachToServer(serverInstance, '/debugger-proxy');
        ms = messageSocket.attachToServer(serverInstance, '/message');
        webSocketProxy.attachToServer(serverInstance, '/devtools');
        if (inspectorProxy) {
          inspectorProxy.attachToServer(serverInstance, '/inspector');
        }
      }
      resolve(serverInstance);
    })
  );
};

const startWebpackDevServer = (hasBackend: boolean, zen: Zen, builder: Builder, reporter, logger) => {
  const webpack = builder.require('webpack');

  const config = builder.config;
  const platform = builder.stack.platform;

  const configOutputPath = config.output.path;
  config.output.path = '/';
  
  let vendorHashesJson;
  let vendorSourceListMap;
  let vendorSource;
  let vendorMap;

  if (builder.webpackDll && builder.child) {
    const name = getDllName(builder);
    const jsonPath = path.join(builder.dllBuildDir, `${name}_dll.json`);
    const json = JSON.parse(fs.readFileSync(path.resolve('./' + jsonPath)).toString());

    config.plugins.push(
      new webpack.DllReferencePlugin({
        context: process.cwd(),
        manifest: json
      })
    );
    vendorHashesJson = JSON.parse(
      fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll_hashes.json`)).toString()
    );
    vendorSource = new RawSource(
      fs.readFileSync(path.join(builder.dllBuildDir, vendorHashesJson.name)).toString() + '\n'
    );
    if (platform !== 'web') {
      const vendorAssets = JSON.parse(
        fs.readFileSync(path.join(builder.dllBuildDir, vendorHashesJson.name + '.assets')).toString()
      );
      config.plugins.push(new MobileAssetsPlugin(vendorAssets));
    }
    if (builder.sourceMap) {
      vendorMap = new RawSource(
        fs.readFileSync(path.join(builder.dllBuildDir, vendorHashesJson.name + '.map')).toString()
      );
      vendorSourceListMap = fromStringWithSourceMap(vendorSource.source(), JSON.parse(vendorMap.source()));
    }
  }

  const compiler = webpack(config);
  let awaitedAlready = false;

  hookAsync(compiler, 'after-emit', (compilation, callback) => {
    if (!awaitedAlready) {
      if (hasBackend || builder.waitOn) {
        let waitOnUrls;
        const backendOption = builder.backendUrl || builder.backendUrl;
        if (backendOption) {
          const { protocol, hostname, port } = url.parse(backendOption.replace('{ip}', ip.address()));
          waitOnUrls = [`tcp:${hostname}:${port || (protocol === 'https:' ? 443 : 80)}`];
        } else {
          waitOnUrls = builder.waitOn ? [].concat(builder.waitOn) : undefined;
        }
        if (waitOnUrls && waitOnUrls.length) {
          logger.debug(`waiting for ${waitOnUrls}`);
          const waitStart = Date.now();
          const waitNotifier = setInterval(() => {
            logger.debug(`still waiting for ${waitOnUrls} after ${Date.now() - waitStart}ms...`);
          }, 10000);
          const waitOn = builder.require('wait-on');
          waitOn({ resources: waitOnUrls }, err => {
            clearInterval(waitNotifier);
            awaitedAlready = true;
            if (err) {
              logger.error(err);
            } else {
              logger.debug('Backend has been started, resuming webpack dev server...');
            }
            callback();
          });
        } else {
          awaitedAlready = true;
          callback();
        }
      } else {
        callback();
      }
    } else {
      callback();
    }
  });
  if (builder.webpackDll && builder.child && platform !== 'web') {
    hookAsync(compiler, 'after-compile', (compilation, callback) => {
      compilation.chunks.forEach(chunk => {
        chunk.files.forEach(file => {
          if (file.endsWith('.bundle')) {
            if (builder.sourceMap) {
              const sourceListMap = new SourceListMap();
              sourceListMap.add(vendorSourceListMap);
              sourceListMap.add(
                fromStringWithSourceMap(
                  compilation.assets[file].source(),
                  JSON.parse(compilation.assets[file + '.map'].source())
                )
              );
              const sourceAndMap = sourceListMap.toStringWithSourceMap({ file });
              compilation.assets[file] = new RawSource(sourceAndMap.source);
              compilation.assets[file + '.map'] = new RawSource(JSON.stringify(sourceAndMap.map));
            } else {
              compilation.assets[file] = new ConcatSource(vendorSource, compilation.assets[file]);
            }
          }
        });
      });
      callback();
    });
  }

  if (builder.webpackDll && builder.child && platform === 'web' && !builder.ssr) {
    hookAsync(compiler, 'after-compile', (compilation, callback) => {
      compilation.assets[vendorHashesJson.name] = vendorSource;
      if (builder.sourceMap) {
        compilation.assets[vendorHashesJson.name + '.map'] = vendorMap;
      }
      callback();
    });
    hookSync(compiler, 'compilation', compilation => {
      hookAsync(compilation, 'html-webpack-plugin-before-html-processing', (htmlPluginData, callback) => {
        htmlPluginData.assets.js.unshift('/' + vendorHashesJson.name);
        callback(null, htmlPluginData);
      });
    });
  }

  let frontendFirstStart = true;

  hookSync(compiler, 'done', stats => {
    // if (stats.compilation.errors && stats.compilation.errors.length) {
    //   stats.compilation.errors.forEach(error => logger.error(error.message));
    // }
    const dir = configOutputPath;
    mkdirp.sync(dir);
    if (stats.compilation.assets['assets.json']) {
      const assetsMap = JSON.parse(stats.compilation.assets['assets.json'].source());
      const prefix = compiler.outputPath;
      _.each(stats.toJson(clientStats).assetsByChunkName, (assets, bundle) => {
        const bundleJs = assets.constructor === Array ? assets[0] : assets;
        assetsMap[`${bundle}.js`] = prefix + bundleJs;
        if (assets.length > 1) {
          assetsMap[`${bundle}.js.map`] = prefix + `${bundleJs}.map`;
        }
      });
      if (builder.webpackDll) {
        assetsMap['vendor.js'] = prefix + vendorHashesJson.name;
      }
      fs.writeFileSync(path.join(dir, 'assets.json'), JSON.stringify(assetsMap));
    }
    if (stats.compilation.assets['loadable-stats.json']) {
      fs.writeFileSync(path.join(dir, 'loadable-stats.json'), stats.compilation.assets['loadable-stats.json'].source());
    }
    if (frontendFirstStart) {
      frontendFirstStart = false;
      try {
        if (builder.stack.hasAny('react-native')) {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          startExpoProject(zen, builder, logger);
        }
      } catch (e) {
        logger.error(e.stack);
      }
    }
  });

  let serverPromise;

  if (platform === 'web') {
    const WebpackDevServer = builder.require('webpack-dev-server');

    const serverInstance = new WebpackDevServer(compiler, {
      ...config.devServer,
      reporter: (opts1, opts2) => {
        const opts = opts2 || opts1;
        const { state, stats } = opts;
        if (state) {
          logger.debug('bundle is now VALID.');
        } else {
          logger.debug('bundle is now INVALID.');
        }
        reporter(null, stats);
      }
    });
    serverPromise = new Promise(resolve => {
      serverInstance.listen(builder.config.devServer.port, () => {
        resolve(serverInstance);
      });
    });
  } else {
    const webpackHotMiddleware = builder.require('webpack-hot-middleware');
    const webpackDevMiddleware = builder.require('webpack-dev-middleware');

    // Workaround for bug in Haul /symbolicate under Windows
    compiler.options.output.path = path.sep;
    const devMiddleware = webpackDevMiddleware(
      compiler,
      _.merge({}, builder.config.devServer, {
        reporter(mwOpts, { state, stats }) {
          if (state) {
            logger.info('bundle is now VALID.');
          } else {
            logger.info('bundle is now INVALID.');
          }
          reporter(null, stats);
        }
      })
    );

    serverPromise = startReactNativeServer(builder, zen, logger, app => {
      app.use(liveReloadMiddleware(compiler)).use(symbolicateMiddleware(compiler, logger));
      app.use((req, res, next) => {
        if (builder.stack.platform !== 'web') {
          // Workaround for Expo Client bug in parsing Content-Type header with charset
          const origSetHeader = res.setHeader;
          res.setHeader = (key, value) => {
            let val = value;
            if (key === 'Content-Type' && value.indexOf('application/javascript') >= 0) {
              val = value.split(';')[0];
            }
            origSetHeader.call(res, key, val);
          };
          const query = url.parse(req.url, true).query;
          const urlPlatform = query && query.platform;
          if (urlPlatform && urlPlatform !== builder.stack.platform) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`Serving '${builder.stack.platform}' bundles, but got request from '${urlPlatform}'`);
            return;
          }
        }
        return devMiddleware(req, res, next);
      });
      app.use(webpackHotMiddleware(compiler, { log: false }));
    });
  }
  serverPromise.then(() => {
    logger.info(`Webpack dev server listening on http://localhost:${config.devServer.port}`);
  });
};

const startClientWebpack = (hasBackend, zen, builder) => {
  const webpack = builder.require('webpack');

  const config = builder.config;
  const configOutputPath = config.output.path;

  const VirtualModules = builder.require('webpack-virtual-modules');
  const clientVirtualModules = new VirtualModules({
    [path.join(builder.projectRoot, 'node_modules', 'backend_reload.js')]: ''
  });
  config.plugins.push(clientVirtualModules);
  frontendVirtualModules.push(clientVirtualModules);

  const logger = minilog(`${config.name}-webpack`);
  if (builder.silent) {
    (logger as any).suggest.deny(/.*/, 'debug');
  }
  try {
    const reporter = (...args) => webpackReporter(zen, builder, configOutputPath, logger, ...args);

    if (zen.watch) {
      startWebpackDevServer(hasBackend, zen, builder, reporter, logger);
    } else {
      if (builder.stack.platform !== 'web') {
        config.plugins.push(new MobileAssetsPlugin());
      }

      const compiler = webpack(config);

      compiler.run(reporter);
    }
  } catch (err) {
    logger.error(err.message, err.stack);
  }
};

let backendReloadCount = 0;
const increaseBackendReloadCount = builder => {
  backendReloadCount++;
  for (const virtualModules of frontendVirtualModules) {
    virtualModules.writeModule(
      path.join(builder.projectRoot, 'node_modules', 'backend_reload.js'),
      `var count = ${backendReloadCount};\n`
    );
  }
};

const startServerWebpack = (zen, builder) => {
  const config = builder.config;
  const logger = minilog(`${config.name}-webpack`);
  if (builder.silent) {
    (logger as any).suggest.deny(/.*/, 'debug');
  }

  try {
    const webpack = builder.require('webpack');
    const reporter = (...args) => webpackReporter(zen, builder, config.output.path, logger, ...args);

    const compiler = webpack(config);

    if (zen.watch) {
      hookSync(compiler, 'done', stats => {
        if (stats.compilation.errors && stats.compilation.errors.length) {
          stats.compilation.errors.forEach(error => logger.error(error.message));
        }
      });

      hookSync(compiler, 'compilation', compilation => {
        hookSync(compilation, 'after-optimize-assets', assets => {
          // Patch webpack-generated original source files path, by stripping hash after filename
          const mapKey = _.findKey(assets, (v, k) => k.endsWith('.map'));
          if (mapKey) {
            const srcMap = JSON.parse(assets[mapKey]._value);
            for (const idx of Object.keys(srcMap.sources)) {
              srcMap.sources[idx] = srcMap.sources[idx].split(';')[0];
            }
            assets[mapKey]._value = JSON.stringify(srcMap);
          }
        });
      });

      compiler.watch({}, reporter);

      hookSync(compiler, 'done', stats => {
        if (!stats.compilation.errors.length) {
          const { output } = config;
          startBackend = true;
          if (server) {
            if (!__WINDOWS__) {
              server.kill('SIGUSR2');
            }

            if (builder.frontendRefreshOnBackendChange) {
              for (const module of stats.compilation.modules) {
                if (module.built && module.resource && module.resource.indexOf('server') >= 0) {
                  // Force front-end refresh on back-end change
                  logger.debug('Force front-end current page refresh, due to change in backend at:', module.resource);
                  process.send({ cmd: BACKEND_CHANGE_MSG });
                  break;
                }
              }
            }
          } else {
            runServer(builder.require.cwd, path.join(output.path, 'index.js'), builder.nodeDebugger, logger);
          }
        }
      });
    } else {
      compiler.run(reporter);
    }
  } catch (err) {
    logger.error(err.message, err.stack);
  }
};

const deviceLoggers = {};

const mirrorExpoLogs = (builder: Builder, projectRoot: string) => {
  const bunyan = builder.require('@expo/bunyan');

  if (!bunyan._patched) {
    deviceLoggers[projectRoot] = minilog('expo-for-' + builder.name);

    const origCreate = bunyan.createLogger;
    bunyan.createLogger = opts => {
      const logger = origCreate.call(bunyan, opts);
      const origChild = logger.child;
      logger.child = (...args) => {
        const child = origChild.apply(logger, args);
        const patched = { ...child };
        for (const name of ['info', 'debug', 'warn', 'error']) {
          patched[name] = (...logArgs) => {
            const [obj, msg] = logArgs;
            if (!obj.issueCleared) {
              let message;
              try {
                const json = JSON.parse(msg);
                message = json.stack ? json.message + '\n' + json.stack : json.message;
              } catch (e) {
                // continue, regardless of error
              }
              message = message || msg || obj;
              deviceLoggers[projectRoot][name].apply(deviceLoggers[projectRoot], [message]);
              child[name].call(child, logArgs);
            }
          };
        }
        return patched;
      };
      return logger;
    };
    bunyan._patched = true;
  }
};

const startExpoServer = async (zen: Zen, builder: Builder, projectRoot: string, packagerPort) => {
  const { Config, Project, ProjectSettings } = builder.require('xdl');

  mirrorExpoLogs(builder, projectRoot);

  Config.validation.reactNativeVersionWarnings = false;
  Config.developerTool = 'crna';
  Config.offline = true;

  await Project.startExpoServerAsync(projectRoot);
  await ProjectSettings.setPackagerInfoAsync(projectRoot, {
    packagerPort
  });
};

const launchExpoApp = async (builder: Builder, platform: string, logger) => {
  const { UrlUtils, Android, Simulator } = builder.require('xdl');
  const qr = builder.require('qrcode-terminal');

  const projectRoot = path.join(builder.require.cwd, '.expo', platform);

  const address = await UrlUtils.constructManifestUrlAsync(projectRoot);
  const localAddress = await UrlUtils.constructManifestUrlAsync(projectRoot, {
    hostType: 'localhost'
  });
  logger.info(`Expo address for ${platform}, Local: ${localAddress}, LAN: ${address}`);
  logger.info(
    "To open this app on your phone scan this QR code in Expo Client (if it doesn't get started automatically)"
  );
  qr.generate(address, code => {
    logger.info('\n' + code);
  });
  if (!isDocker()) {
    if (platform === 'android' || platform === 'all') {
      const { success, error } = await Android.openProjectAsync(projectRoot);

      if (!success) {
        logger.error(error.message);
      }
    }
    if (platform === 'ios' || platform === 'all') {
      const { success, msg } = await Simulator.openUrlInSimulatorSafeAsync(localAddress);

      if (!success) {
        logger.error('Failed to start Simulator: ', msg);
      }
    }
  }
};

const copyExpoImage = (cwd: string, expoDir: string, appJson: any, keyPath: string) => {
  const imagePath: string = _.get(appJson, keyPath);
  if (imagePath) {
    const absImagePath = path.join(cwd, imagePath);
    fs.writeFileSync(path.join(expoDir, path.basename(absImagePath)), fs.readFileSync(absImagePath));
    _.set(appJson, keyPath, path.basename(absImagePath));
  }
};

const setupExpoDir = (zen: Zen, builder: Builder, dir, platform) => {
  const reactNativeDir = path.join(dir, 'node_modules', 'react-native');
  mkdirp.sync(path.join(reactNativeDir, 'local-cli'));
  fs.writeFileSync(
    path.join(reactNativeDir, 'package.json'),
    fs.readFileSync(builder.require.resolve('react-native/package.json'))
  );
  fs.writeFileSync(path.join(reactNativeDir, 'local-cli/cli.js'), '');

  const reactDir = path.join(dir, 'node_modules', 'react');
  mkdirp.sync(reactDir);
  fs.writeFileSync(path.join(reactDir, 'package.json'), fs.readFileSync(builder.require.resolve('react/package.json')));

  const pkg = JSON.parse(fs.readFileSync(builder.require.resolve('./package.json')).toString());
  const origDeps = pkg.dependencies;
  delete pkg.devDependencies;
  pkg.dependencies = { react: origDeps.react, 'react-native': origDeps['react-native'] };
  if (platform !== 'all') {
    pkg.name = pkg.name + '-' + platform;
  }
  pkg.main = `index.mobile`;
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  const appJson = JSON.parse(fs.readFileSync(builder.require.resolve('./app.json'), 'utf8'));
  [
    'expo.icon',
    'expo.ios.icon',
    'expo.android.icon',
    'expo.splash.image',
    'expo.ios.splash.image',
    'expo.ios.splash.tabletImage',
    'expo.android.splash.ldpi',
    'expo.android.splash.mdpi',
    'expo.android.splash.hdpi',
    'expo.android.splash.xhdpi',
    'expo.android.splash.xxhdpi',
    'expo.android.splash.xxxhdpi'
  ].forEach(keyPath => copyExpoImage(builder.require.cwd, dir, appJson, keyPath));
  fs.writeFileSync(path.join(dir, 'app.json'), JSON.stringify(appJson, null, 2));
  let expRcJson: any = {};
  try {
    expRcJson = JSON.parse(fs.readFileSync(builder.require.resolve('./.exprc'), 'utf8'));
  } catch (e) {
    // continue, regardless of error
  }
  if (platform !== 'all') {
    expRcJson.manifestPort = expoPorts[platform];
  }
  fs.writeFileSync(path.join(dir, '.exprc'), JSON.stringify(expRcJson, null, 2));
};

const startExpoProject = async (zen: Zen, builder: Builder, logger: any) => {
  const platform = builder.stack.platform;

  try {
    const projectRoot = path.join(builder.require.cwd, '.expo', platform);
    setupExpoDir(zen, builder, projectRoot, platform);
    await startExpoServer(zen, builder, projectRoot, builder.config.devServer.port);
    await launchExpoApp(builder, platform, logger);
  } catch (e) {
    logger.error(e.stack);
  }
};

const isDllValid = (zen, builder, logger): boolean => {
  const name = getDllName(builder);
  try {
    const hashesPath = path.join(builder.dllBuildDir, `${name}_dll_hashes.json`);
    if (!fs.existsSync(hashesPath)) {
      return false;
    }
    const relMeta = JSON.parse(fs.readFileSync(hashesPath).toString());
    if (LARIX_DLL_VERSION !== relMeta.version) {
      return false;
    }
    if (!fs.existsSync(path.join(builder.dllBuildDir, relMeta.name))) {
      return false;
    }
    if (builder.sourceMap && !fs.existsSync(path.join(builder.dllBuildDir, relMeta.name + '.map'))) {
      return false;
    }
    if (!_.isEqual(relMeta.modules, builder.child.config.entry.vendor)) {
      return false;
    }

    const json = JSON.parse(fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`)).toString());

    for (const entryFilename of Object.keys(json.content)) {
      const filename = entryFilename.split('!').pop();
      if (filename.indexOf(' ') < 0 && filename.indexOf('@virtual') < 0) {
        if (!fs.existsSync(filename)) {
          logger.warn(`${name} DLL need to be regenerated, file: ${filename} is missing.`);
          return false;
        }
        const hash = createHash('md5')
          .update(fs.readFileSync(filename))
          .digest('hex');
        if (relMeta.hashes[filename] !== hash) {
          logger.warn(`Hash for ${name} DLL file ${filename} has changed, need to rebuild it`);
          return false;
        }
      }
    }

    return true;
  } catch (e) {
    logger.warn(`Error checking vendor bundle ${name}, regenerating it...`, e);

    return false;
  }
};

const buildDll = (zen: Zen, builder: Builder) => {
  const webpack = builder.require('webpack');
  const config = builder.child.config;
  return new Promise(done => {
    const name = getDllName(builder);
    const logger = minilog(`${config.name}-webpack`);
    if (builder.silent) {
      (logger as any).suggest.deny(/.*/, 'debug');
    }
    const reporter = (...args) => webpackReporter(zen, builder, config.output.path, logger, ...args);

    if (!isDllValid(zen, builder, logger)) {
      logger.debug(`Generating ${name} DLL bundle with modules:\n${JSON.stringify(config.entry.vendor)}`);

      mkdirp.sync(builder.dllBuildDir);
      const compiler = webpack(config);

      hookSync(compiler, 'done', stats => {
        try {
          const json = JSON.parse(fs.readFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`)).toString());
          const vendorKey = _.findKey(
            stats.compilation.assets,
            (v, key) => key.startsWith('vendor') && key.endsWith('_dll.js')
          );
          const assets = [];
          stats.compilation.modules.forEach(module => {
            if (module._asset) {
              assets.push(module._asset);
            }
          });
          fs.writeFileSync(path.join(builder.dllBuildDir, `${vendorKey}.assets`), JSON.stringify(assets));

          const meta = { name: vendorKey, hashes: {}, modules: config.entry.vendor, version: LARIX_DLL_VERSION };
          for (const filename of Object.keys(json.content)) {
            if (filename.indexOf(' ') < 0 && filename.indexOf('@virtual') < 0) {
              meta.hashes[filename] = createHash('md5')
                .update(fs.readFileSync(filename.split('!').pop()))
                .digest('hex');
            }
          }

          fs.writeFileSync(path.join(builder.dllBuildDir, `${name}_dll_hashes.json`), JSON.stringify(meta));
          fs.writeFileSync(path.join(builder.dllBuildDir, `${name}_dll.json`), JSON.stringify(json));
        } catch (e) {
          logger.error(e.stack);
          process.exit(1);
        }
        done();
      });

      compiler.run(reporter);
    } else {
      done();
    }
  });
};

const startWebpack = async (zen: Zen, builder: Builder, platforms: any) => {
  if (builder.stack.platform === 'server') {
    startServerWebpack(zen, builder);
  } else {
    startClientWebpack(!!platforms.server, zen, builder);
  }
};

const allocateExpoPorts = async expoPlatforms => {
  const startPorts = { android: 19000, ios: 19500 };
  for (const platform of expoPlatforms) {
    const expoPort = await detectPort(startPorts[platform]);
    expoPorts[platform] = expoPort;
  }
};

const startExpoProdServer = async (zen: Zen, mainBuilder: Builder, builders: Builders, expCmd: string, logger) => {
  const mime = mainBuilder.require('mime', mainBuilder.require.resolve('webpack-dev-middleware'));
  const { UrlUtils } = mainBuilder.require('xdl');

  logger.info(`Starting Expo prod server`);
  const packagerPort = 3030;
  mainBuilder.config.devServer.port = packagerPort;

  await startReactNativeServer(mainBuilder, zen, logger, app => {
    app.use((req, res, next) => {
      if (req.path === '/onchange') {
        return;
      }
      const platform = url.parse(req.url, true).query.platform;
      if (platform) {
        let platformFound = false;
        for (const name of Object.keys(builders)) {
          const builder = builders[name];
          if (builder.stack.hasAny(platform)) {
            platformFound = true;
            const filePath = builder.buildDir
              ? path.join(builder.buildDir, req.path)
              : path.join(builder.frontendBuildDir || `build/client`, platform.toString(), req.path);
            if (fs.existsSync(filePath)) {
              res.writeHead(200, { 'Content-Type': mime.lookup ? mime.lookup(filePath) : mime.getType(filePath) });
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
        }

        if (!platformFound) {
          logger.error(
            `Bundle for '${platform}' platform is missing! You need to build bundles both for Android and iOS.`
          );
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(`{"message": "File not found for request: ${req.path}"}`);
        }
      } else {
        next();
      }
    });
  });

  logger.info(`Production mobile packager listening on http://localhost:${packagerPort}`);

  const projectRoot = path.join(path.resolve('.'), '.expo', 'all');
  await startExpoServer(zen, mainBuilder, projectRoot, packagerPort);
  if (expCmd === 'server') {
    await launchExpoApp(mainBuilder, 'all', logger);
  } else {
    const address = await UrlUtils.constructManifestUrlAsync(projectRoot);
    logger.info(`Expo server running on LAN url: ${address}`);
  }
};

const startExp = async (zen: Zen, builders: Builders, logger) => {
  let mainBuilder: Builder;
  for (const name of Object.keys(builders)) {
    const builder = builders[name];
    if (builder.stack.hasAny(['ios', 'android'])) {
      mainBuilder = builder;
      break;
    }
  }
  if (!mainBuilder) {
    throw new Error('Builders for `ios` or `android` not found');
  }

  const projectRoot = path.join(process.cwd(), '.expo', 'all');
  setupExpoDir(zen, mainBuilder, projectRoot, 'all');
  const expIdx = process.argv.indexOf('exp');
  if (['ba', 'bi', 'build:android', 'build:ios', 'publish', 'p', 'server'].indexOf(process.argv[expIdx + 1]) >= 0) {
    await startExpoProdServer(zen, mainBuilder, builders, process.argv[expIdx + 1], logger);
  }
  if (process.argv[expIdx + 1] !== 'server') {
    const exp = spawn(
      path.join(process.cwd(), 'node_modules/.bin/exp' + (__WINDOWS__ ? '.cmd' : '')),
      process.argv.splice(expIdx + 1),
      {
        cwd: projectRoot,
        stdio: [0, 1, 2]
      }
    );
    exp.on('exit', code => {
      process.exit(code);
    });
  }
};

const runBuilder = (cmd: string, builder: Builder, platforms) => {
  process.chdir(builder.require.cwd);
  const zen = new Zen(builder.require.cwd, cmd);
  if (builder.stack.hasAny('webpack')) {
    const prepareDllPromise: PromiseLike<any> =
      zen.watch && builder.webpackDll && builder.child ? buildDll(zen, builder) : Promise.resolve();
    prepareDllPromise.then(() => startWebpack(zen, builder, platforms));
  } else {
    throw new Error(
      `builder '${builder.name}' stack does not include 'webpack'. Consider let zen guess your stack by removing 'stack' propery.`
    );
  }
};

const execute = (cmd: string, argv: any, builders: Builders, zen: Zen) => {
  const expoPlatforms = [];
  const platforms = {};
  Object.keys(builders).forEach(name => {
    const builder = builders[name];
    const stack = builder.stack;
    platforms[stack.platform] = true;
    if (stack.hasAny('react-native') && stack.hasAny('ios')) {
      expoPlatforms.push('ios');
    } else if (stack.hasAny('react-native') && stack.hasAny('android')) {
      expoPlatforms.push('android');
    }
  });

  if (cluster.isMaster) {
    if (argv.verbose) {
      Object.keys(builders).forEach(name => {
        const builder = builders[name];
        zenLogger.log(`${name} = `, require('util').inspect(builder.config, false, null));
      });
    }

    if (cmd === 'exp') {
      startExp(zen, builders, zenLogger);
    } else if (cmd === 'test') {
      // TODO: Remove this in 0.2.x
      let builder;
      for (const name of Object.keys(builders)) {
        builder = builders[name];
        if (builder.roles.indexOf('test') >= 0) {
          const testArgs = ['--webpack-config', builder.require.resolve('@larix/zen/webpack.config.js')];
          if (builder.stack.hasAny('react')) {
            const majorVer = builder.require('react/package.json').version.split('.')[0];
            const reactVer = majorVer >= 16 ? majorVer : 15;
            if (reactVer >= 16) {
              testArgs.push('--include', 'raf/polyfill');
            }
          }
          const haveMochapack = builder.require.probe('mochapack');
          if (!haveMochapack && !builder.require.probe('mocha-webpack')) {
            throw new Error('Unable to find `mochapack`, please add it to the project');
          }
          const mochapackCmd = haveMochapack ? 'mochapack' : 'mocha-webpack';

          const testCmd = path.join(process.cwd(), 'node_modules/.bin/' + mochapackCmd + (__WINDOWS__ ? '.cmd' : ''));
          testArgs.push(...process.argv.slice(process.argv.indexOf('test') + 1));
          zenLogger.info(`Running ${testCmd} ${testArgs.join(' ')}`);

          const env: any = Object.create(process.env);
          if (argv.c) {
            env.SPIN_CWD = zen.cwd;
            env.SPIN_CONFIG = path.resolve(argv.c);
          }

          const mochaWebpack = spawn(testCmd, testArgs, {
            stdio: [0, 1, 2],
            env,
            cwd: builder.require.cwd
          });
          mochaWebpack.on('close', code => {
            if (code !== 0) {
              process.exit(code);
            }
          });
        }
      }
    } else {
      const prepareExpoPromise =
        zen.watch && expoPlatforms.length > 0 ? allocateExpoPorts(expoPlatforms) : Promise.resolve();
      prepareExpoPromise.then(() => {
        const workerBuilders = {};

        for (const id of Object.keys(builders)) {
          const builder = builders[id];
          if (builder.stack.hasAny(['dll', 'test'])) {
            continue;
          }
        }

        for (const id of Object.keys(builders)) {
          const builder = builders[id];
          if (builder.stack.hasAny(['dll', 'test'])) {
            continue;
          }

          if (!builder.cluster) {
            const worker = cluster.fork({
              BUILDER_ID: id,
              BUILDER_CONFIG_PATH: builder.configPath,
              EXPO_PORTS: JSON.stringify(expoPorts)
            });
            workerBuilders[worker.process.pid] = builder;
          } else {
            runBuilder(cmd, builder, platforms);
          }
        }

        for (const id of Object.keys(cluster.workers)) {
          cluster.workers[id].on('message', msg => {
            debug(`Master received message ${JSON.stringify(msg)}`);
            for (const wid of Object.keys(cluster.workers)) {
              cluster.workers[wid].send(msg);
            }
          });
        }

        cluster.on('exit', (worker, code, signal) => {
          if (cmd !== 'build') {
            zenLogger.warn(`Worker ${workerBuilders[worker.process.pid].id} died, code: ${code}, signal: ${signal}`);
          } else if (cmd === 'build' && code !== 0) {
            process.exit(code);
          }
        });
      });
    }
  } else {
    const builder = builders[process.env.BUILDER_ID];
    const builderExpoPorts = JSON.parse(process.env.EXPO_PORTS);
    for (const platform of Object.keys(builderExpoPorts)) {
      expoPorts[platform] = builderExpoPorts[platform];
    }
    process.on('message', msg => {
      if (msg.cmd === BACKEND_CHANGE_MSG) {
        debug(`Increase backend reload count in ${builder.id}`);
        increaseBackendReloadCount(builder);
      }
    });

    runBuilder(cmd, builder, platforms);
  }
};

export default execute;
