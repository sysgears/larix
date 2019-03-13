import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

const ONE_HOUR = 3600 * 1000;

export default async (registry: string, cacheDir: string): Promise<void> => {
  const cacheConfigPath = path.join(cacheDir, 'larix.json');
  const json = fs.existsSync(cacheConfigPath) ? JSON.parse(fs.readFileSync(cacheConfigPath, 'utf8')) : {};
  json.lastUpdateCheck = json.lastUpdateCheck || 0;
  const time = new Date().getTime();
  if (time - json.lastUpdateCheck > ONE_HOUR) {
    const metadata = (await axios.get(registry + 'larix')).data;
    const latest = metadata['dist-tags'].latest.trim().split('.');
    const version = require('../../package.json')
      .version.trim()
      .split('.');
    for (let idx = 0; idx < 3; idx++) {
      const ld = +latest[idx];
      const vd = +version[idx];
      if (ld !== vd) {
        if (ld > vd) {
          console.log(
            `New ${chalk.cyan('larix')} ${latest.join('.')} is available. You are using version ${version.join(
              '.'
            )}. Use:\n${chalk.blueBright('larix global add larix')}\nto upgrade`
          );
        }
        break;
      }
    }
    json.lastUpdateCheck = time;
  }
  fs.mkdirpSync(path.dirname(cacheConfigPath));
  fs.writeFileSync(cacheConfigPath, JSON.stringify(json));
};
