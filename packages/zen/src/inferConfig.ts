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

const isZenApp = (pkg: any): boolean => {
  return (
    Object.keys(pkg.dependencies || {})
      .concat(Object.keys(pkg.devDependencies || {}))
      .indexOf('zen') >= 0 ||
    (pkg.scripts && pkg.scripts.build && pkg.scripts.build.indexOf('zen build') >= 0)
  );
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
    for (const pkgPath of pkgPathList) {
      if (fs.existsSync(pkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const requireDep = createRequire(path.dirname(pkgPath));
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
    if (!entry) {
      throw new Error('Cannot find entry file, tried: ' + entryCandidates);
    }

    const stack: string[] = [];
    let isMobile = false;
    if (deps['apollo-server-express'] || deps.express) {
      stack.push('server');
    }
    if (deps['swagger-ui-express'] || deps['swagger-jsdoc']) {
      stack.push('rest');
    }
    if (deps['react-native']) {
      stack.push('android');
      isMobile = true;
    } else if (deps['react-dom'] || deps['@angular/core'] || deps.vue) {
      stack.push('web');
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
    if (relRequire.probe('css-loader') && !isMobile) {
      stack.push('css');
    }
    if (relRequire.probe('sass-loader') && !isMobile) {
      stack.push('sass');
    }
    if (relRequire.probe('less-loader') && !isMobile) {
      stack.push('less');
    }
    if (relRequire.probe('@alienfast/i18next-loader')) {
      stack.push('i18next');
    }
    if (relRequire.probe('webpack')) {
      stack.push('webpack');
    }

    let config;
    const builderDefaults = {
      entry,
      silent: true,
      nodeDebugger: false,
      infered: true
    };
    if (stack.indexOf('react-native') >= 0) {
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
      const platform = new Stack(...stack).platform;
      const builder = {
        stack,
        ...builderDefaults
      };

      config = {
        builders: {
          [platform]: builder,
          test: {
            stack: stack.map(tech => (tech !== platform ? tech : 'server')),
            roles: ['test'],
            defines: {
              __TEST__: true
            }
          }
        }
      };
    }

    return config;
  } catch (e) {
    e.message = `while infering config for: ${pkgJsonPath}: ` + e.message;
    throw e;
  }
};
