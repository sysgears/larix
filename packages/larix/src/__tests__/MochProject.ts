import axios from 'axios';
import * as fs from 'fs-extra';
import gunzip from 'gunzip-maybe';
import * as path from 'path';
import * as tar from 'tar-stream';
import * as tmp from 'tmp';

export default class MochProject {
  public dir: string;
  public name: string;

  constructor(name: string) {
    this.name = name;
    this.dir = this._create();
  }

  public async install(dependency: string, registryUrl: string) {
    let name;
    let version;
    const idx = dependency.indexOf('@', 1);
    if (idx < 0) {
      name = dependency;
    } else {
      name = dependency.substring(0, idx);
      version = dependency.substring(idx + 1);
    }

    let metadata;
    try {
      metadata = (await axios.get(registryUrl + name)).data.versions[version];
    } catch (e) {
      e.message = `while fetching ${registryUrl + name} ${e.message}`;
      throw e;
    }
    const tgz = (await axios.get(metadata.dist.tarball, { responseType: 'stream' })).data;
    const installDir = path.join(this.dir, 'node_modules', name);
    return new Promise(resolve => {
      const extract = tar.extract();
      extract.on('entry', (header, stream, next) => {
        const entryName = header.name.substring(header.name.search(/[/\\]/) + 1);
        const entryDir = path.join(installDir, path.dirname(entryName));
        fs.mkdirpSync(entryDir);

        const entryPath = path.join(installDir, entryName);
        const writeStream = fs.createWriteStream(entryPath);
        stream.pipe(writeStream);
        writeStream.on('close', () => {
          next();
        });
      });

      extract.on('finish', () => {
        const pkgJsonPath = path.join(this.dir, 'package.json');
        const json = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        json.dependencies = json.dependencies || {};
        json.dependencies[name] = version;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(json));
        resolve();
      });

      tgz.pipe(gunzip()).pipe(extract);
    });
  }

  private _create() {
    const projTmpDir = tmp.dirSync({ unsafeCleanup: true });
    const projDir = projTmpDir.name;
    fs.writeFileSync(path.join(projDir, 'package.json'), `{"name": "${this.name}", "version": "0.0.1"}`);

    return projDir;
  }
}
