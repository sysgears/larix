import * as cluster from 'cluster';
import * as fs from 'fs';
import minilog from 'minilog';

import { Builder } from './Builder';
import BuilderDiscoverer from './BuilderDiscoverer';
import { ConfigPlugin } from './ConfigPlugin';
import ConfigReader from './ConfigReader';
import getProjectRoot from './getProjectRoot';
import AngularPlugin from './plugins/AngularPlugin';
import ApolloPlugin from './plugins/ApolloPlugin';
import BabelPlugin from './plugins/BabelPlugin';
import CssProcessorPlugin from './plugins/CssProcessorPlugin';
import FlowRuntimePLugin from './plugins/FlowRuntimePlugin';
import I18NextPlugin from './plugins/I18NextPlugin';
import ReactHotLoaderPlugin from './plugins/ReactHotLoaderPlugin';
import ReactNativePlugin from './plugins/ReactNativePlugin';
import ReactNativeWebPlugin from './plugins/ReactNativeWebPlugin';
import ReactPlugin from './plugins/ReactPlugin';
import RestPlugin from './plugins/RestPlugin';
import StyledComponentsPlugin from './plugins/StyledComponentsPlugin';
import TCombPlugin from './plugins/TCombPlugin';
import TypeScriptPlugin from './plugins/TypeScriptPlugin';
import VuePlugin from './plugins/VuePlugin';
import WebAssetsPlugin from './plugins/WebAssetsPlugin';
import WebpackPlugin from './plugins/WebpackPlugin';
import Stack from './Stack';
import Zen from './Zen';

const WEBPACK_OVERRIDES_NAME = 'webpack.overrides.js';

const zenLogger = minilog('zen');

const createBuilders = ({
  cwd,
  cmd,
  argv,
  builderName,
  builderOverrides,
  genConfigOverrides
}: {
  cwd: string;
  cmd: string;
  argv: any;
  builderName?: string;
  builderOverrides?: any;
  genConfigOverrides?: any;
}) => {
  const builders = {};

  const plugins = [
    new WebpackPlugin(),
    new WebAssetsPlugin(),
    new CssProcessorPlugin(),
    new ApolloPlugin(),
    new TypeScriptPlugin(),
    new BabelPlugin(),
    new ReactPlugin(),
    new TCombPlugin(),
    new FlowRuntimePLugin(),
    new ReactNativePlugin(),
    new ReactNativeWebPlugin(),
    new StyledComponentsPlugin(),
    new AngularPlugin(),
    new VuePlugin(),
    new I18NextPlugin(),
    new RestPlugin(),
    new ReactHotLoaderPlugin()
  ];
  const zen = new Zen(cwd, cmd);
  let role = cmd;
  if (cmd === 'exp') {
    role = 'build';
  } else if (cmd === 'start') {
    role = 'watch';
  }

  let discoveredBuilders;
  if (cluster.isMaster) {
    const builderDiscoverer = new BuilderDiscoverer(zen, plugins, argv);

    discoveredBuilders = builderDiscoverer.discover(builderOverrides);
  } else {
    discoveredBuilders = new ConfigReader(zen, plugins).readConfig({
      ...(argv.x ? { inferedConfig: {} } : {}),
      filePath: process.env.BUILDER_CONFIG_PATH,
      builderOverrides
    });
  }
  if (!discoveredBuilders) {
    throw new Error('Cannot find zen config');
  }
  if (cluster.isMaster && argv.verbose) {
    zenLogger.log('Zen Config:\n', require('util').inspect(discoveredBuilders, false, null));
  }

  for (const builderId of Object.keys(discoveredBuilders)) {
    const builder = discoveredBuilders[builderId];
    const stack = builder.stack;
    if (builder.roles.indexOf(role) < 0 || (process.env.BUILDER_ID && builderId !== process.env.BUILDER_ID)) {
      continue;
    }

    builder.enabled = builder.enabled !== false;
    if (argv.d && [].concat(argv.d).some(regex => new RegExp(regex).test(builderId))) {
      builder.enabled = false;
    }
    if (
      (argv.e && [].concat(argv.e).some(regex => new RegExp(regex).test(builderId))) ||
      builder.name === builderName
    ) {
      builder.enabled = true;
    }

    if (builder.enabled) {
      builder.projectRoot = getProjectRoot(builder.require.cwd);
    }

    if (zen.dev && builder.webpackDll && !stack.hasAny('server') && !builderName) {
      const dllBuilder: Builder = { ...builder };
      dllBuilder.name = builder.name + 'Dll';
      try {
        dllBuilder.require = builder.require;
        dllBuilder.parent = builder;
        dllBuilder.stack = new Stack(dllBuilder.name, ...dllBuilder.stack.technologies, 'dll');
        builders[`${builderId.split('[')[0]}[${builder.name}Dll]`] = dllBuilder;
        builder.child = dllBuilder;
      } catch (e) {
        e.message = `while creating builder '${dllBuilder.name}': ` + e.message;
        throw e;
      }
    }
    builders[builderId] = builder;
  }

  for (const builderId of Object.keys(builders)) {
    const builder = builders[builderId];
    if (!builder.enabled) {
      continue;
    }

    const overridesConfig = builder.overridesConfig || WEBPACK_OVERRIDES_NAME;
    const overrides = fs.existsSync(overridesConfig) ? builder.require('./' + overridesConfig) : {};

    builder.depPlatforms = overrides.dependencyPlatforms || builder.depPlatforms || {};
    builder.dllExcludes = builder.dllExcludes || [];
    builder.plugins.forEach((plugin: ConfigPlugin) => plugin.configure(builder, zen));

    const strategy = {
      entry: 'replace',
      stats: 'replace'
    };
    if (overrides[builder.name]) {
      builder.config = zen.mergeWithStrategy(strategy, builder.config, overrides[builder.name]);
    }
    builder.config = zen.mergeWithInStrategy(zen.createConfig(builder, 'webpack', builder.config), genConfigOverrides);
  }

  return { builders, zen };
};

export default createBuilders;
