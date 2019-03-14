import cachedir from 'cachedir';
import 'source-map-support/register';
import * as parser from 'yargs-parser';

import { addPrefabs, removePrefabs } from './prefabs';
import { checkNewVersion } from './version';
import { runYarn, runYarnAndGetLastLine, yarnYargsOpts } from './yarn';

(async () => {
  try {
    const argv = parser(process.argv.slice(2), yarnYargsOpts);
    const cacheDir = cachedir('larix');

    const registry = await runYarnAndGetLastLine(['config', 'get', 'registry']);
    await checkNewVersion(registry, cacheDir);
    if (argv.v) {
      console.log(require('../package.json').version);
    } else {
      if (argv._.length >= 1 && argv._[0] === 'remove') {
        const packageNames = argv._.slice(1);
        await removePrefabs(packageNames, registry, cacheDir);
      }
      await runYarn(process.argv.slice(2));

      if (argv._.length === 0 || (argv._.length >= 1 && ['add', 'install'].indexOf(argv._[0]) >= 0 && !argv.v)) {
        await addPrefabs(registry, cacheDir);
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();