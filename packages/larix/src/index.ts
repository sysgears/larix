import 'source-map-support/register';
import * as parser from 'yargs-parser';

import { addPrefabs, removePrefabs } from './prefabs';
import { checkNewVersion } from './version';
import { runYarn, runYarnAndGetLastLine, yarnYargsOpts } from './yarn';

(async () => {
  const argv = parser(process.argv.slice(2), yarnYargsOpts);

  const registry = await runYarnAndGetLastLine(['config', 'get', 'registry']);
  await checkNewVersion(registry);
  if (argv.v) {
    console.log(require('../package.json').version);
  } else {
    if (argv._.length >= 1 && argv._[0] === 'remove') {
      const packageNames = argv._.slice(1);
      await removePrefabs(packageNames, registry);
    }
    await runYarn(process.argv.slice(2));

    if (argv._.length === 0 || (argv._.length >= 1 && ['add', 'install'].indexOf(argv._[0]) >= 0 && !argv.v)) {
      await addPrefabs(registry);
    }
  }
})().catch(e => console.error(e));
