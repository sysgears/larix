import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import { getDirFiles } from '../fs';
import { addPrefabs } from '../prefabs';
import { downloadPrefab } from '../prefabs/download';
import MockProject from './MochProject';
import MockRegistry from './MockRegistry';

tmp.setGracefulCleanup();

describe('larix', () => {
  let registry;

  beforeAll(async () => {
    registry = new MockRegistry();
    return registry.start();
  });

  beforeEach(() => {
    registry.clear();
  });

  afterAll(async () => {
    return registry.stop();
  });

  it('should be able to download prefab from registry', async () => {
    await registry.publish({
      'index.ts': `console.log('Hello!');`,
      'package.json': `{"name": "@gqlapp/module-server-ts", "version": "0.0.1"}`
    });
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const dir = await downloadPrefab({
      name: '@gqlapp/module-server-ts',
      version: '0.0.1',
      registry: registry.url,
      cacheDir: tmpDir.name
    });
    const files = fs.readdirSync(dir);
    expect(files).toContain('.larix-metadata.json');
    expect(files).toContain('.larix-tarball.tgz');
    expect(files).toContain('index.ts');
    expect(files).toContain('package.json');
  });

  it('should be able to create mock project and install dependency', async () => {
    await registry.publish({
      'index.ts': `console.log('Hello!');`,
      'package.json': `{"name": "@gqlapp/module-server-ts", "version": "0.0.1"}`
    });
    const project = new MockProject('my-proj');
    await project.install('@gqlapp/module-server-ts@0.0.1', registry.url);
    const files = getDirFiles(project.dir);
    const pkgJson = JSON.parse(fs.readFileSync(path.join(project.dir, 'package.json'), 'utf8'));
    expect(files).toContain('package.json');
    expect(files).toContain('node_modules/@gqlapp/module-server-ts/index.ts');
    expect(files).toContain('node_modules/@gqlapp/module-server-ts/package.json');
    expect(pkgJson.dependencies).toHaveProperty('@gqlapp/module-server-ts');
  });

  it('should be able to install a prefab', async () => {
    const cacheDir = tmp.dirSync({ unsafeCleanup: true }).name;
    await registry.publish({
      'index.ts': `console.log('Hello!');`,
      'package.json': `{"name": "@gqlapp/core-server-ts", "larix": "modules/core", "version": "0.0.1"}`
    });
    const project = new MockProject('my-proj');
    await project.install('@gqlapp/core-server-ts@0.0.1', registry.url);
    await addPrefabs(registry.url, cacheDir);
    const files = getDirFiles(project.dir);
    console.log(files);
  });
});
