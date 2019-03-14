import generate, { templateWriter } from '@larix/generator';
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

generate(templates, templateWriter, 'yarn create apollo-app', process.argv);
