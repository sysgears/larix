import axios from 'axios';
import * as fs from 'fs-extra';
import * as gunzip from 'gunzip-maybe';
import * as path from 'path';
import * as tar from 'tar-stream';

import { getPrefabCacheDir } from '../cache';

const downloadPrefab = async (name, version, registry): Promise<string> => {
  const prefabCacheDir = getPrefabCacheDir(name, version);
  if (!fs.existsSync(prefabCacheDir)) {
    fs.mkdirpSync(prefabCacheDir);
    const metadata = (await axios.get(registry + name)).data.versions[version];
    fs.writeFileSync(path.join(prefabCacheDir, '.larix-metadata.json'), JSON.stringify(metadata));
    const tgz = (await axios.get(metadata.dist.tarball, { responseType: 'arraybuffer' })).data;
    const tarballPath = path.join(prefabCacheDir, '.larix-tarball.tgz');
    fs.writeFileSync(tarballPath, tgz);
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      const entryName = header.name.substring(header.name.search(/[\/\\]/) + 1);
      fs.mkdirpSync(path.join(prefabCacheDir, path.dirname(entryName)));

      stream.on('end', () => {
        next();
      });

      stream.pipe(fs.createWriteStream(path.join(prefabCacheDir, name)));
    });

    fs.createReadStream(tarballPath)
      .pipe(gunzip())
      .pipe(extract);
  }
  return prefabCacheDir;
};

export { downloadPrefab };
