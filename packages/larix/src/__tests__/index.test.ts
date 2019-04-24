import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import { parsePkgVersionFromPatch } from '../diff';
import { getDirFiles } from '../fs';
import { addPrefabs, removePrefabs } from '../prefabs';
import { downloadPrefab } from '../prefabs/download';
import MockProject from './MochProject';
import MockRegistry from './MockRegistry';

tmp.setGracefulCleanup();

describe('larix', () => {
  let registry;
  let cacheDir;
  let project;

  const createPatch = async () => {
    await registry.publish({
      'index.ts': `console.log('Hello!');`,
      'package.json': `{"name": "@gqlapp/core-server-ts", "larix": "modules/core", "version": "0.0.1"}`
    });
    await project.install('@gqlapp/core-server-ts@0.0.1', registry.url);
    await addPrefabs({ projectRoot: project.dir, registryUrl: registry.url, cacheDir });
    fs.writeFileSync(path.join(project.dir, 'modules/core/index.ts'), `// Comment\nconsole.log('Hello!');`);
    await removePrefabs({
      packageNames: ['@gqlapp/core-server-ts'],
      projectRoot: project.dir,
      registryUrl: registry.url,
      cacheDir
    });
  };

  beforeAll(async () => {
    registry = new MockRegistry();
    return registry.start();
  });

  beforeEach(() => {
    cacheDir = tmp.dirSync({ unsafeCleanup: true }).name;
    project = new MockProject('my-proj');
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
      registryUrl: registry.url,
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
    await project.install('@gqlapp/module-server-ts@0.0.1', registry.url);
    const files = getDirFiles(project.dir);
    const pkgJson = JSON.parse(fs.readFileSync(path.join(project.dir, 'package.json'), 'utf8'));
    expect(files).toContain('package.json');
    expect(files).toContain('node_modules/@gqlapp/module-server-ts/index.ts');
    expect(files).toContain('node_modules/@gqlapp/module-server-ts/package.json');
    expect(pkgJson.dependencies).toHaveProperty('@gqlapp/module-server-ts');
  });

  it('should be able to install a prefab', async () => {
    await registry.publish({
      'index.ts': `console.log('Hello!');`,
      'package.json': `{"name": "@gqlapp/core-server-ts", "larix": "modules/core", "version": "0.0.1"}`
    });
    await project.install('@gqlapp/core-server-ts@0.0.1', registry.url);
    await addPrefabs({ projectRoot: project.dir, registryUrl: registry.url, cacheDir });
    const files = getDirFiles(project.dir);
    expect(files).toContain('modules/core/index.ts');
    expect(files).toContain('modules/core/package.json');
  });

  it('should be able to remove a prefab and save changes in a patch', async () => {
    await registry.publish({
      'index.ts': `console.log('Hello!');`,
      'package.json': `{"name": "@gqlapp/core-server-ts", "larix": "modules/core", "version": "0.0.1"}`
    });
    await project.install('@gqlapp/core-server-ts@0.0.1', registry.url);
    await addPrefabs({ projectRoot: project.dir, registryUrl: registry.url, cacheDir });
    fs.writeFileSync(path.join(project.dir, 'modules/core/index.ts'), `// Comment\nconsole.log('Hello!');`);
    await removePrefabs({
      packageNames: ['@gqlapp/core-server-ts'],
      projectRoot: project.dir,
      registryUrl: registry.url,
      cacheDir
    });
    const files = getDirFiles(project.dir);
    expect(files).not.toContain('node_modules/@gqlapp/module-server-ts/index.ts');
    expect(files).toContain('modules/core/core.patch');
  });

  it('should throw on non-larix patch', async () => {
    const patchPath = path.join(path.join(project.dir, 'index.patch'));
    fs.writeFileSync(
      patchPath,
      '--- index.ts       2019-03-25 16:35:41.918\n' +
        '+++ index.ts        2019-03-25 16:35:41.914\n' +
        '@@ -1,1 +1,2 @@\n' +
        '+// Comment\n' +
        `console.log('Hello!');\n` +
        ' No newline at end of file\n'
    );
    expect(() => parsePkgVersionFromPatch(patchPath)).toThrow();
  });

  it('should be able to determine version from created patch', async () => {
    await createPatch();
    const patchPath = path.join(project.dir, 'modules/core/core.patch');
    expect(fs.existsSync(patchPath)).toBeTruthy();
    expect(parsePkgVersionFromPatch(patchPath)).toEqual('0.0.1');
  });

  it('should be able to install prefab and apply patch', async () => {});
});
