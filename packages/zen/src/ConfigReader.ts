import * as fs from 'fs';
import * as path from 'path';
import merge from 'webpack-merge';

import { Builders } from './Builder';
import { ConfigPlugin } from './ConfigPlugin';
import createRequire from './createRequire';
import EnhancedError from './EnhancedError';
import inferConfig from './inferConfig';
import Stack from './Stack';
import Zen from './Zen';

interface ReadConfigOptions {
  filePath: string;
  inferedConfig?: any;
  builderOverrides?: any;
}

export default class ConfigReader {
  private zen: Zen;
  private plugins: ConfigPlugin[];

  constructor(zen: Zen, plugins: ConfigPlugin[]) {
    this.zen = zen;
    this.plugins = plugins;
  }

  public readConfig(options: ReadConfigOptions): Builders {
    const { filePath, inferedConfig, builderOverrides } = options;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const dir = filePath;
      let derivedConfig = {};
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        derivedConfig = inferedConfig || inferConfig(path.join(dir, 'package.json'));
      }
      const candidates = ['.zenrc.json', '.zenrc', '.zenrc.js', 'package.json'];
      for (const fileName of candidates) {
        const configPath = path.join(dir, fileName);
        if (fs.existsSync(configPath)) {
          try {
            const builders = this.readConfig({ filePath: configPath, inferedConfig: derivedConfig, builderOverrides });
            if (builders) {
              return builders;
            }
          } catch (e) {
            e.message = `while processing ${configPath}: ${e.message}`;
            throw e;
          }
        }
      }
    } else {
      const derivedConfig = inferedConfig || inferConfig(path.join(path.dirname(filePath), 'package.json'));
      let configObject: any;
      if (fs.existsSync(filePath)) {
        process.chdir(path.dirname(filePath));
        try {
          const extname = path.extname(filePath);
          if (['.json', ''].indexOf(extname) >= 0) {
            try {
              configObject = JSON.parse(fs.readFileSync(filePath).toString());
              if (path.basename(filePath) === 'package.json') {
                configObject = configObject.zen;
              }
            } catch (e) {
              throw new EnhancedError(`Error parsing ${path.resolve(filePath)}`, e);
            }
          } else {
            const exports = require(path.resolve(filePath));
            configObject = exports instanceof Function ? exports(this.zen) : exports;
          }
        } finally {
          process.chdir(this.zen.cwd);
        }
      }
      return typeof configObject === 'undefined' && !fs.existsSync(filePath)
        ? undefined
        : this._createBuilders(filePath, configObject, derivedConfig, builderOverrides);
    }
  }

  private _createBuilders(filePath: string, config: any, derivedConfig: any, builderOverrides: any): Builders {
    config = config || {};
    derivedConfig = derivedConfig || {};
    for (const derivedName of Object.keys(derivedConfig.builders || {})) {
      const derPlatform = Stack.getPlatform(derivedConfig.builders[derivedName].stack);
      const derRoles = derivedConfig.builders[derivedName].roles;
      for (const name of Object.keys(config.builders || {})) {
        let fullStack = config.builders[name].stack || [];
        if (config.options && config.options.stack) {
          fullStack = [...fullStack, ...config.options.stack];
        }
        const platform = Stack.getPlatform(fullStack);
        const roles = config.builders[name].roles;
        if (platform && derPlatform && platform === derPlatform && derRoles === roles && name !== derivedName) {
          const tmp = derivedConfig.builders[derivedName];
          delete derivedConfig.builders[derivedName];
          derivedConfig.builders[name] = tmp;
          // Manual stack definition should override derived config
          if (config.builders[name].stack) {
            delete derivedConfig.builders[name].stack;
          }
        }
      }
    }
    if (Object.keys(config).length > 0) {
      for (const derivedName of Object.keys(derivedConfig.builders || {})) {
        delete derivedConfig.builders[derivedName].silent;
      }
    }
    config = this.zen.merge(derivedConfig, config);
    config.options = config.options || {};

    const relativePath = path.relative(this.zen.cwd, path.dirname(filePath));
    const builders: Builders = {};
    const { stack, plugins, ...options } = config.options;
    for (const name of Object.keys(config.builders || {})) {
      try {
        const builderVal = config.builders[name];
        let builder: any = this.zen.mergeWithInStrategy(
          typeof builderVal === 'object' && builderVal.constructor !== Array
            ? { ...builderVal }
            : { stack: builderVal },
          builderOverrides
        );
        if (typeof config.options.stack === 'undefined' && typeof builder.stack === 'undefined') {
          if (derivedConfig.builders && derivedConfig.builders[name]) {
            builder = this.zen.merge(derivedConfig.builders[name], builder);
          } else {
            throw new Error(
              `builder has no stack defined.\nIf this is your custom builder, you must define 'stack'\nIf you mean to override options for infered builder, specify its name as a key from the list: ${JSON.stringify(
                Object.keys(derivedConfig.builders || {})
              )}`
            );
          }
        }
        builder.stack = new Stack(config.options.stack || [], typeof builder === 'object' ? builder.stack : builder);
        builder.name = name;
        builder.require = createRequire(path.resolve(relativePath));
        builder.plugins = (config.plugins || []).concat(builder.plugins || []);
        builder.roles = builder.roles || ['build', 'watch'];
        const merged = merge(options, builder);
        for (const key of Object.keys(merged)) {
          builder[key] = merged[key];
        }
        const builderId = `${relativePath}[${builder.name}]`;
        builder.id = builderId;
        builder.configPath = filePath;
        builders[builderId] = builder;
        // TODO: remove backendBuildDir, frontendBuildDir in 0.5.x
        builder.buildDir =
          builder.backendBuildDir || builder.frontendBuildDir ? undefined : builder.buildDir || 'build';
        builder.nodeDebugger = typeof builder.nodeDebugger !== 'undefined' ? builder.nodeDebugger : true;
        builder.webpackDll = typeof builder.webpackDll !== 'undefined' ? builder.webpackDll : true;
        builder.sourceMap = typeof builder.sourceMap !== 'undefined' ? builder.sourceMap : true;
        builder.minify = typeof builder.minify !== 'undefined' ? builder.minify : true;
        builder.cache =
          typeof builder.cache === 'string' && builder.cache !== 'auto'
            ? builder.cache
            : typeof builder.cache !== 'undefined'
            ? builder.cache
            : 'auto';
        if (builder.infered) {
          builder.dllBuildDir =
            builder.dllBuildDir ||
            path.join(typeof builder.cache === 'string' && builder.cache !== 'auto' ? builder.cache : '.cache', 'dll');
        } else {
          builder.dllBuildDir = builder.dllBuildDir || 'build/dll';
        }
        builder.plugins = this.plugins.concat((builder.plugins || []).map(pluginName => new (require(pluginName))()));
      } catch (e) {
        e.message = `while creating builder '${name}': ` + e.message;
        throw e;
      }
    }
    return builders;
  }
}
