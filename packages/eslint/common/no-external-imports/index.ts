import * as fs from 'fs';
import * as path from 'path';

const DEPENDENCIES_VARIANTS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const getDependencies = (fileDirPath: string, moduleDependencies: Set<string>): void => {
  const dirPath = path.resolve(path.dirname(fileDirPath));
  const packageJsonPath = findFilesystemEntity(dirPath, 'package.json');
  if (typeof packageJsonPath !== 'undefined') {
    getDependenciesFromPackageJson(packageJsonPath, moduleDependencies);
  }
  checkDependenciesInNodeModules(dirPath, moduleDependencies);
};

function checkDependenciesInNodeModules(currentFolderPath: string, packageJsonDependencies: Set<string>) {
  const nodeModulesPath = findFilesystemEntity(currentFolderPath, 'node_modules');
  if (typeof nodeModulesPath !== 'undefined') {
    collectNodeModulesDependencies(nodeModulesPath, packageJsonDependencies);
  }
  if (currentFolderPath !== '/') {
    checkDependenciesInNodeModules(path.dirname(currentFolderPath), packageJsonDependencies);
  }
}

function findFilesystemEntity(current: string, name: string) {
  let prev;
  do {
    const fileName = path.join(current, name);
    if (fs.existsSync(fileName)) {
      return fileName;
    }
    prev = current;
    current = path.dirname(current);
  } while (prev !== current);
  {
    return undefined;
  }
}

function collectNodeModulesDependencies(currentPath: string, packageJsonDependencies: Set<string>) {
  const nodeModulesFolders = fs.readdirSync(currentPath);
  for (const moduleFolder of nodeModulesFolders) {
    const stat = fs.lstatSync(path.join(currentPath, moduleFolder));
    if (packageJsonDependencies.has(moduleFolder)) {
      if (stat.isSymbolicLink()) {
        getDependenciesFromPackageJson(path.join(currentPath, moduleFolder, 'package.json'), packageJsonDependencies);
      }
    }

    if (stat.isDirectory()) {
      const currentPathInDirectory = path.join(currentPath, moduleFolder);
      const nodeModulesFoldersInDirectory = fs.readdirSync(currentPathInDirectory);
      for (const moduleFolderInDirectory of nodeModulesFoldersInDirectory) {
        const statInDirectory = fs.lstatSync(path.join(currentPathInDirectory, moduleFolderInDirectory));
        if (statInDirectory.isSymbolicLink()) {
          const pathFolderInDirectory =
            currentPathInDirectory.split('/')[currentPathInDirectory.split('/').length - 1] +
            '/' +
            moduleFolderInDirectory;
          if (packageJsonDependencies.has(pathFolderInDirectory)) {
            getDependenciesFromPackageJson(
              path.join(currentPath, pathFolderInDirectory, 'package.json'),
              packageJsonDependencies
            );
          }
        }
      }
    }
  }
}

function getDependenciesFromPackageJson(packageJsonPath: string, moduleDependencies: Set<string>) {
  const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8').replace(/^\uFEFF/, ''));
  DEPENDENCIES_VARIANTS.forEach(dependencyVariant => {
    if (typeof content[dependencyVariant] !== 'undefined') {
      addDependencies(moduleDependencies, content[dependencyVariant]);
    }
  });
}

function addDependencies(moduleDependencies: Set<string>, dependencies: { [key: string]: string }) {
  for (const name in dependencies) {
    if (dependencies.hasOwnProperty(name)) {
      moduleDependencies.add(name);
    }
  }
}

export default getDependencies;
