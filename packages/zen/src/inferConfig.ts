import * as fs from 'fs';
import * as path from 'path';

import createRequire from './createRequire';
import { getTopDeps } from './deps';
import getProjectRoot from './getProjectRoot';

const entryExts = ['js', 'jsx', 'ts', 'tsx'];
const entryDirs = ['.', 'src'];
let entryCandidates = [];
for (const dir of entryDirs) {
  entryCandidates = entryCandidates.concat(entryExts.map(ext => './' + path.join(dir, 'index.' + ext)));
}

enum Platform {
  Server = 'server',
  Web = 'web',
  Mobile = 'mobile'
}

const isZenApp = (pkg: any): boolean => {
  const hasZenDep =
    Object.keys(pkg.dependencies || {})
      .concat(Object.keys(pkg.devDependencies || {}))
      .indexOf('zen') >= 0;
  if (hasZenDep) {
    return true;
  } else {
    for (const key of Object.keys(pkg.scripts || [])) {
      if (pkg.scripts[key].indexOf('zen ') >= 0) {
        return true;
      }
    }
  }
  return false;
};

export default (pkgJsonPath: string): object => {
  try {
    if (!pkgJsonPath || !fs.existsSync(pkgJsonPath)) {
      return {};
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (!isZenApp(pkgJson)) {
      return {};
    }
    const projectRoot = getProjectRoot(path.dirname(pkgJsonPath));
    const localPkg = getTopDeps(pkgJsonPath, projectRoot, createRequire(path.dirname(pkgJsonPath)));
    const rootPkg = getTopDeps(path.join(projectRoot, 'package.json'), projectRoot, createRequire(projectRoot));
    const pkg: any = {};
    for (const depGroup of ['dependencies', 'devDependencies']) {
      pkg[depGroup] = { ...(localPkg[depGroup] || {}), ...(rootPkg[depGroup] || {}) };
      pkg[depGroup] = Object.keys(pkg[depGroup] || {})
        .sort()
        .reduce((acc, key) => {
          if (!pkg[depGroup][key].startsWith('| ') && !pkg[depGroup][key].startsWith('optional:')) {
            acc[key] = pkg[depGroup][key];
          }
          return acc;
        }, {});
    }
    const deps = pkg.dependencies;
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    let entry;
    for (const entryPath of entryCandidates) {
      if (fs.existsSync(path.join(path.dirname(pkgJsonPath), entryPath))) {
        entry = entryPath;
        break;
      }
    }

    const stack: string[] = [];
    let platform: Platform;
    if (deps['apollo-server-express'] || deps.express) {
      stack.push('server');
      platform = Platform.Server;
    }
    if (deps['swagger-ui-express'] || deps['swagger-jsdoc']) {
      stack.push('rest');
    }
    if (!platform && deps['react-native']) {
      stack.push('android');
      platform = Platform.Mobile;
    } else if (!platform && (deps.react || deps['@angular/core'] || deps.vue)) {
      platform = Platform.Web;
      stack.push('web');
    }
    if (deps.graphql) {
      stack.push('apollo');
    }
    if (allDeps['babel-core'] || allDeps['@babel/core']) {
      stack.push('es6');
    }
    stack.push('js');
    if (allDeps.typescript) {
      stack.push('ts');
    }
    if (deps['apollo-server-express'] || deps['react-apollo'] || deps['apollo-boost'] || deps['apollo-link']) {
      stack.push('apollo');
    }
    if (deps.react) {
      stack.push('react');
    }
    if (deps['@angular/core']) {
      stack.push('angular');
    }
    if (deps.vue) {
      stack.push('vue');
    }
    if (deps['react-native']) {
      stack.push('react-native');
    }
    if (deps['styled-components']) {
      stack.push('styled-components');
    }
    if (deps['react-hot-loader']) {
      stack.push('react-hot-loader');
    }
    if (allDeps['css-loader'] && platform !== Platform.Mobile) {
      stack.push('css');
    }
    if (allDeps['sass-loader'] && platform !== Platform.Mobile) {
      stack.push('sass');
    }
    if (allDeps['less-loader'] && platform !== Platform.Mobile) {
      stack.push('less');
    }
    if (allDeps['@alienfast/i18next-loader']) {
      stack.push('i18next');
    }
    if (allDeps.webpack) {
      stack.push('webpack');
    }

    let config;
    const builderDefaults: any = {
      infered: true
    };
    const optionDefaults: any = {
      silent: true,
      nodeDebugger: false
    };

    if (entry) {
      builderDefaults.entry = entry;
    }
    if (platform === Platform.Mobile) {
      const builderAndroid = {
        stack,
        ...builderDefaults
      };

      const iosStack = [...stack];
      iosStack[stack.indexOf('android')] = 'ios';
      const builderIOS = {
        stack: iosStack,
        ...builderDefaults
      };

      config = {
        builders: {
          android: builderAndroid,
          ios: builderIOS
        },
        options: {
          ...optionDefaults,
          defines: {
            __DEV__: process.env.NODE_ENV !== 'production'
          }
        }
      };
    } else {
      const testStack = !platform
        ? stack.concat(['server'])
        : stack.map(tech => (tech !== platform.toString() ? tech : 'server'));
      config = {
        builders: {
          test: {
            stack: testStack,
            roles: ['test'],
            defines: {
              __TEST__: true
            }
          }
        },
        options: {
          ...optionDefaults
        }
      };
      if (platform) {
        const builder = {
          stack,
          ...builderDefaults
        };

        config.builders[platform.toString()] = builder;
      }
    }

    return config;
  } catch (e) {
    e.message = `while infering config for: ${pkgJsonPath}: ` + e.message;
    throw e;
  }
};
