import generate, { templateWriter } from '@larix/generator';
import chalk from 'chalk';
import 'source-map-support/register';

import templates from './templates';

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

export const runCli = async () => {
  const result = await generate(templates, templateWriter, 'yarn create @larix');
  if (!result) return;
  const { appName } = result;

  console.log(`App ${chalk.green(appName)} generated successfully! Execute commands below to start it:\n`);
  console.log(chalk.yellow(`cd ${appName}`));
  console.log(chalk.yellow(`yarn start`));
};
