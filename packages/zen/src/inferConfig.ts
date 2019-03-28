import * as fs from 'fs';
import * as path from 'path';
import createRequire from './createRequire';
import getDeps from './getDeps';
import Stack from './Stack';
import upDirs from './upDirs';

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
    const relRequire = createRequire(path.dirname(pkgJsonPath));
    if (!pkgJsonPath || !fs.existsSync(pkgJsonPath)) {
      return {};
    }
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (!isZenApp(pkg)) {
      return {};
    }
    const pkgPathList = upDirs(path.dirname(pkgJsonPath), 'package.json');
    let deps: any = {};
    const requireDep = createRequire(path.dirname(pkgJsonPath));
    for (const pkgPath of pkgPathList) {
      if (fs.existsSync(pkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        deps = { ...deps, ...getDeps(pkgPath, requireDep, {}), ...(pkgJson.devDependencies || {}) };
      }
    }

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
    } else if (!platform && (deps['react-dom'] || deps['@angular/core'] || deps.vue)) {
      platform = Platform.Web;
      stack.push('web');
    }
    if (deps.graphql) {
      stack.push('apollo');
    }
    if (relRequire.probe('babel-core') || relRequire.probe('@babel/core')) {
      stack.push('es6');
    }
    stack.push('js');
    if (relRequire.probe('typescript')) {
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
    if (relRequire.probe('styled-components')) {
      stack.push('styled-components');
    }
    if (relRequire.probe('css-loader') && platform !== Platform.Mobile) {
      stack.push('css');
    }
    if (relRequire.probe('sass-loader') && platform !== Platform.Mobile) {
      stack.push('sass');
    }
    if (relRequire.probe('less-loader') && platform !== Platform.Mobile) {
      stack.push('less');
    }
    if (relRequire.probe('@alienfast/i18next-loader')) {
      stack.push('i18next');
    }
    if (relRequire.probe('webpack')) {
      stack.push('webpack');
    }

    let config;
    const builderDefaults: any = {
      silent: true,
      nodeDebugger: false,
      infered: true
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
