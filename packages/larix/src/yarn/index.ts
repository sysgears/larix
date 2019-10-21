let yarnCli;

const initYarn = (): void => {
  const origArgv = process.argv;
  const origLog = console.log;
  try {
    // Yarn cli autstarts, so we trick it by passing -v option and disabling output temporary
    process.argv = [process.argv[0], process.argv[1], '-v'];
    console.log = () => {};
    const origWrite = process.stdout.write;
    // Rewrite some critical parts of yarn help to not confuse users
    process.stdout.write = (str: string): any => {
      let text = str;
      if (str.indexOf('yarn help COMMAND') >= 0) {
        text = text.replace('yarn', 'larix');
        return origWrite.apply(process.stdout, [text]);
      } else if (str.indexOf('https://yarnpkg.com/en/docs/cli/') >= 0) {
        if (text.indexOf('Yarn') > 0) {
          text = text.replace('Yarn', 'larix');
          text = text.replace('https://yarnpkg.com/en/docs/cli/', 'https://github.com/sysgears/larix');
          return origWrite.apply(process.stdout, [text]);
        }
      } else {
        return origWrite.apply(process.stdout, [text]);
      }
    };

    yarnCli = require('yarn/lib/cli');
  } finally {
    process.argv = origArgv;
    console.log = origLog;
  }
};

export const runYarn = async (args: string[]): Promise<void> => {
  if (!yarnCli) {
    initYarn();
  }

  const origArgv = process.argv;

  try {
    process.argv = [process.argv[0], process.argv[1]].concat(args);

    // Now we are really starting cli
    return yarnCli.default();
  } finally {
    process.argv = origArgv;
  }
};

export const runYarnAndGetLastLine = async (cmd: string[]): Promise<string> => {
  const origWrite = process.stdout.write;
  try {
    let lastLine;
    process.stdout.write = (str: Buffer | string): boolean => {
      lastLine = str.toString().trim();
      return true;
    };
    await runYarn(cmd);
    return lastLine;
  } finally {
    // eslint-disable-next-line require-atomic-updates
    process.stdout.write = origWrite;
  }
};

export const yarnYargsOpts = {
  alias: {
    v: 'version',
    prod: 'production',
    s: 'silent',
    W: 'ignore-workspace-root-check',
    D: 'dev',
    P: 'peer',
    O: 'optional',
    E: 'exact',
    T: 'tilde',
    h: 'help'
  },
  boolean: [
    'v',
    'verbose',
    'offline',
    'prefer-offline',
    'strict-semver',
    'json',
    'ignore-scripts',
    'har',
    'ignore-platform',
    'ignore-engines',
    'ignore-optional',
    'force',
    'skip-integrity-check',
    'check-files',
    'flat',
    'pure-lockfile',
    'frozen-lockfile',
    'update-checksums',
    'link-duplicates',
    's',
    'non-interactive',
    'focus',
    'W',
    'D',
    'P',
    'O',
    'E',
    'T',
    'h'
  ]
};
