import type { SourceFileEntry } from '../types/graph';
import { parseCppDependencies } from './parsers/cppParser';
import { parseHtmlDependencies } from './parsers/htmlParser';
import { buildJavaProjectIndex, parseJavaDependencies } from './parsers/javaParser';
import { parseJsDependencies } from './parsers/jsParser';
import {
  getCodeFileExtension,
  getLanguageGroup,
  getLanguageLabel,
  isSupportedCodeFile,
} from './parsers/pathUtils';
import { parsePythonDependencies } from './parsers/pythonParser';

export {
  getCodeFileExtension,
  getLanguageGroup,
  getLanguageLabel,
  isSupportedCodeFile,
};

export interface DependencyEdgeCandidate {
  source: string;
  target: string;
}

export function resolveRepoDependencies(
  files: readonly SourceFileEntry[]
): DependencyEdgeCandidate[] {
  const availablePaths = new Set<string>(files.map((file) => file.path));
  const javaIndex = buildJavaProjectIndex(files);
  const edges: DependencyEdgeCandidate[] = [];

  for (const file of files) {
    const ext = getCodeFileExtension(file.path);
    if (!ext) {
      continue;
    }

    let targets: string[] = [];

    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        targets = parseJsDependencies(file.path, file.content, availablePaths);
        break;
      case 'java':
        targets = parseJavaDependencies(file.path, file.content, javaIndex);
        break;
      case 'py':
        targets = parsePythonDependencies(file.path, file.content, availablePaths);
        break;
      case 'c':
      case 'cpp':
      case 'h':
      case 'hpp':
        targets = parseCppDependencies(file.path, file.content, availablePaths);
        break;
      case 'html':
        targets = parseHtmlDependencies(file.path, file.content, availablePaths);
        break;
      case 'css':
        targets = [];
        break;
    }

    for (const target of targets) {
      edges.push({
        source: file.path,
        target,
      });
    }
  }

  return edges;
}
