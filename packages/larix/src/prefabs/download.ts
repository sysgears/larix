import axios from 'axios';
import * as fs from 'fs-extra';
import gunzip from 'gunzip-maybe';
import * as path from 'path';
import * as tar from 'tar-stream';

import { getPrefabCacheDir } from '../cache';

interface DownloadPrefabOptions {
  name: string;
  version: string;
  registryUrl: string;
  cacheDir: string;
}

const downloadPrefab = async (options: DownloadPrefabOptions): Promise<string> => {
  const { name, version, registryUrl, cacheDir } = options;
  const prefabCacheDir = path.join(cacheDir, getPrefabCacheDir(name, version));
  if (!fs.existsSync(prefabCacheDir)) {
    fs.mkdirpSync(prefabCacheDir);

    let metadata;
    try {
      metadata = (await axios.get(registryUrl + name)).data.versions[version];
    } catch (e) {
      e.message = `while fetching ${registryUrl + name} ${e.message}`;
      throw e;
    }
    fs.writeFileSync(path.join(prefabCacheDir, '.larix-metadata.json'), JSON.stringify(metadata));
    const tgz = (await axios.get(metadata.dist.tarball, { responseType: 'arraybuffer' })).data;
    const tarballPath = path.join(prefabCacheDir, '.larix-tarball.tgz');
    fs.writeFileSync(tarballPath, tgz);
    return new Promise(resolve => {
      const extract = tar.extract();
      extract.on('entry', (header, stream, next) => {
        const entryName = header.name.substring(header.name.search(/[/\\]/) + 1);
        const entryDir = path.join(prefabCacheDir, path.dirname(entryName));
        fs.mkdirpSync(entryDir);

        stream.on('end', () => {
          next();
        });

        const entryPath = path.join(prefabCacheDir, entryName);
        stream.pipe(fs.createWriteStream(entryPath));
      });

      extract.on('finish', () => {
        resolve(prefabCacheDir);
      });

      fs.createReadStream(tarballPath)
        .pipe(gunzip())
        .pipe(extract);
    });
  } else {
    return prefabCacheDir;
  }
};

export { downloadPrefab };
