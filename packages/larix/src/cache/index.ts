import * as cachedir from 'cachedir';
import * as path from 'path';

export const CACHE_DIR = cachedir('larix');

export const getPrefabCacheDir = (name, version) =>
  path.join(CACHE_DIR, 'npm-' + name.replace('/', '-') + '-' + version);
