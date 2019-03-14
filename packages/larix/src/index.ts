import cachedir from 'cachedir';
import * as path from 'path';
import 'source-map-support/register';
import * as parser from 'yargs-parser';

import { addPrefabs, removePrefabs } from './prefabs';
import { checkNewVersion } from './version';
import { runYarn, runYarnAndGetLastLine, yarnYargsOpts } from './yarn';

(async () => {
  try {
    const argv = parser(process.argv.slice(2), yarnYargsOpts);
    const cacheDir = cachedir('larix');

    const registryUrl = await runYarnAndGetLastLine(['config', 'get', 'registry']);
    const projectRoot = path.resolve('.');
    await checkNewVersion(registryUrl, cacheDir);
    if (argv.v) {
      console.log(require('../package.json').version);
    } else {
      if (argv._.length >= 1 && argv._[0] === 'remove') {
        const packageNames = argv._.slice(1);
        await removePrefabs({ projectRoot, packageNames, registryUrl, cacheDir });
      }
      await runYarn(process.argv.slice(2));

      if (argv._.length === 0 || (argv._.length >= 1 && ['add', 'install'].indexOf(argv._[0]) >= 0 && !argv.v)) {
        await addPrefabs({ projectRoot, registryUrl, cacheDir });
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
