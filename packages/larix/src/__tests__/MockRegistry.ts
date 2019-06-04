import connect from 'connect';
import http from 'http';
import * as streams from 'memory-streams';
import * as tar from 'tar-stream';
import * as zlib from 'zlib';

const PORT = 3333;

export default class MockRegistry {
  private _server: http.Server;
  private _resources: { [url: string]: Buffer } = {};

  public url;

  public async start() {
    this.url = `http://localhost:${PORT}/`;
    const app = connect();
    app.use((req, res, next) => {
      const resource = this._resources[req.url];
      if (resource) {
        if (req.url.endsWith('.tgz')) {
          res.setHeader('Content-Type', 'application/gzip');
          res.end(resource, 'binary');
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.end(resource);
        }
      } else {
        next();
      }
    });
    return new Promise(resolve => {
      this._server = app.listen(PORT, () => {
        resolve();
      });
    });
  }

  public async publish(files: { [filePath: string]: string }) {
    if (!files['package.json']) {
      throw new Error('npm package must have package.json file');
    }
    const pkgJson = JSON.parse(files['package.json']);
    return new Promise(resolve => {
      const { name, version } = pkgJson;
      const pack = tar.pack();
      for (const filePath of Object.keys(files)) {
        pack.entry({ name: filePath }, files[filePath]);
      }
      pack.finalize();
      const writer = new streams.WritableStream();
      const z = zlib.createGzip();
      pack
        .pipe(z)
        .pipe(writer)
        .on('finish', () => {
          const tarballName =
            name.indexOf('/') < 0 ? name : name.substring(name.indexOf('/') + 1) + '-' + version + '.tgz';
          const metadataUrl = `/${name}`;
          let metadata = { versions: {} };
          if (this._resources[metadataUrl]) {
            metadata = JSON.parse(this._resources[metadataUrl].toString());
          }
          const url = `${metadataUrl}/-/${tarballName}`;
          metadata.versions[version] = { dist: { tarball: this.url.slice(0, -1) + url } };
          this._resources[metadataUrl] = Buffer.from(JSON.stringify(metadata), 'utf8');
          this._resources[url] = writer.toBuffer();
          resolve();
        });
    });
  }

  public clear() {
    this._resources = {};
  }

  public async stop() {
    return new Promise(resolve => {
      this._server.close(() => {
        resolve();
      });
    });
  }
}
