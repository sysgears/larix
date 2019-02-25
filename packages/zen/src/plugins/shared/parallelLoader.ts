import * as os from 'os';
import * as path from 'path';

import { Builder } from '../../Builder';
import Zen from '../../Zen';

export const hasParallelLoalder = (builder: Builder) => {
  return !!builder.require.probe('thread-loader');
};

export const addParalleLoaders = (builder: Builder, zen: Zen, compilerRules) => {
  const cacheLoader = builder.require.probe('cache-loader');
  const threadLoader = builder.require.probe('thread-loader');
  const result = compilerRules.slice(0);
  if (threadLoader) {
    result.unshift({
      loader: 'thread-loader',
      options: zen.createConfig(builder, 'threadLoader', {
        workers: os.cpus().length - 1
      })
    });
  }
  if (cacheLoader && !!builder.cache) {
    result.unshift({
      loader: 'cache-loader',
      options: zen.createConfig(builder, 'cacheLoader', {
        cacheDirectory: path.join(
          typeof builder.cache === 'string' && builder.cache !== 'auto' ? builder.cache : '.cache',
          'cache-loader'
        )
      })
    });
  }
  return result;
};
