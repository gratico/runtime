import { IRuntime, ModuleDependency } from '../../specs/index'
import { ILogicalTree } from '../../../src/runtime/utils/npm_tree'
import { getLogicalTree } from './dependency_tree'
import nodePath from '../../utils/path'
import coreModules from '../../runtime/node/core/index'
import { isRelative } from '../../npm/node-module-resolution/index'
// parse depName into an object
export function parseNPMModuleLocation(path: string): { name: string; path?: string; main: boolean } {
  const parts = path.split('/')
  if (path[0] === '@') {
    const main = parts.length === 2
    return {
      name: parts.slice(0, 2).join('/'),
      ...(main ? {} : { path: './' + parts.slice(2).join('/') }),
      main,
    }
  } else {
    const main = parts.length === 1
    return {
      main,
      name: parts[0],
      ...(main ? {} : { path: './' + parts.slice(1).join('/') }),
    }
  }
}

// retrun physical path from address field of ILogicalTree
export function getModuleLocaton(moduleTree: ILogicalTree) {
  const modulePath = (moduleTree.address as string)
    .split(':')
    .reduce(function (state: string[], key, i) {
      return [...state, 'node_modules', key]
    }, [])
    .join('/')
  return modulePath
}

export function getModulePath(runtime: IRuntime, lTree: ILogicalTree, parsedPath: any) {
  const pkgJSON = runtime.cache.get(`${lTree.name}@${lTree.version}/package.json`)
  if (!pkgJSON) {
    console.log([...runtime.cache.keys()])
    console.log(pkgJSON, `${lTree.name}@${lTree.version}/package.json`)
  }
  // console.log(lTree, pkgJSON);
  const main = pkgJSON.main || pkgJSON.files[0]
  if (!parsedPath.main) {
    return './' + nodePath.join(parsedPath.path)
  } else {
    return './' + nodePath.join(main)
  }
}
export async function convertPathToModuleDependency(
  runtime: IRuntime,
  path: string,
  specifiedPath: string,
  lTree: ILogicalTree,
  parentDep: ModuleDependency | undefined,
): Promise<ModuleDependency> {
  const importIsRelative = isRelative(path)
  const moduleTree: ILogicalTree = lTree
  if (Object.keys(coreModules).indexOf(path) > -1) {
    return {
      type: 'core',
      specifiedPath: path,
      pkg: moduleTree,
      modulePath: path,
      resolvedFSPath: path,
      parent: parentDep,
    }
  }
  if (importIsRelative) {
    return {
      parent: parentDep,
      specifiedPath,
      pkg: moduleTree,
      modulePath: '.',
      resolvedFSPath: path,
      type: 'source',
    }
  } else {
    const npmModule = parseNPMModuleLocation(path)
    let tree = moduleTree.dependencies.get(npmModule.name)
    if (!tree) {
      const rootTree = await getLogicalTree(runtime.props.fs, runtime.props.workDir)
      tree = rootTree.dependencies.get(npmModule.name)
    }
    if (!tree) {
      console.error(npmModule, path)
      //      debugger
      throw new Error('runtime #convertPathToModuleDependency ')
    }
    const modulePath = getModuleLocaton(tree)
    // console.log(npmModule, tree);
    // console.log("meta", meta, tree, npmModule);
    return {
      parent: parentDep,
      type: 'npm',
      pkg: tree,
      specifiedPath: path,
      modulePath,
      resolvedFSPath: npmModule.main
        ? getModulePath(runtime, tree, npmModule)
        : './' + nodePath.join(npmModule.path || 'index.js'),
    }
  }
}