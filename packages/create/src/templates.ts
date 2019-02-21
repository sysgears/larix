import { DirRoots, getTemplateFilePaths, Template, TemplateFilePaths } from '@larix/generator';

const getWorkspaceRelFiles = (packages: string[]): TemplateFilePaths =>
  getTemplateFilePaths(
    ([{ srcRoot: __dirname + '/../templates/workspace', dstRoot: '.' }] as DirRoots[]).concat(
      packages.map(name => ({
        srcRoot: __dirname + '/../templates/' + name,
        dstRoot: 'packages/' + name
      }))
    )
  );

const templates: Template[] = [
  {
    title: '@server-web-rest: TypeScript, REST, Express server, React for web',
    files: getWorkspaceRelFiles(['server-rest', 'web-rest'])
  },
  {
    title: '@server-mobile-rest: TypeScript, REST, Express server, React Native for mobile',
    files: getWorkspaceRelFiles(['server-rest', 'mobile-rest'])
  },
  {
    title: '@universal-rest: TypeScript, REST, Express server, React for web, React Native for mobile',
    files: getWorkspaceRelFiles(['server-rest', 'web-rest', 'mobile-rest'])
  },
  {
    title: '@server-rest: TypeScript, REST, Express server',
    files: getTemplateFilePaths(__dirname + '/../templates/server-rest')
  },
  {
    title: '@web-rest: TypeScript, REST, React web app',
    files: getTemplateFilePaths(__dirname + '/../templates/web-rest')
  },
  {
    title: '@mobile-rest: TypeScript, REST, React Native for mobile',
    files: getTemplateFilePaths(__dirname + '/../templates/mobile-rest')
  },
  {
    title: '@server-web-graphql: TypeScript, Apollo (GraphQL), Express server, React for web',
    files: getWorkspaceRelFiles(['server', 'web'])
  },
  {
    title: '@server-mobile-graphql: TypeScript, Apollo (GraphQL), Express server, React Native for mobile',
    files: getWorkspaceRelFiles(['server', 'mobile'])
  },
  {
    title: '@universal-graphql: TypeScript, Apollo (GraphQL), Express server, React for web, React Native for mobile',
    files: getWorkspaceRelFiles(['server', 'web', 'mobile'])
  },
  {
    title: '@server-graphql: TypeScript, Apollo (GraphQL), Express server',
    files: getTemplateFilePaths(__dirname + '/../templates/server')
  },
  {
    title: '@web-graphql: TypeScript, Apollo (GraphQL), React web app',
    files: getTemplateFilePaths(__dirname + '/../templates/web')
  },
  {
    title: '@mobile-graphql: TypeScript, Apollo (GraphQL), React Native for mobile',
    files: getTemplateFilePaths(__dirname + '/../templates/mobile')
  }
];

export default templates;
