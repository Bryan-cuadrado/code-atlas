import type { SourceFileEntry } from '../../types/graph';
import { getCodeFileExtension, stripCStyleComments } from './pathUtils';

export interface JavaProjectIndex {
  byFqn: ReadonlyMap<string, string>;
  byPackage: ReadonlyMap<string, readonly string[]>;
}

function getFileBaseName(path: string): string {
  const slashIndex = path.lastIndexOf('/');
  const fileName = slashIndex === -1 ? path : path.slice(slashIndex + 1);
  return fileName.replace(/\.java$/i, '');
}

export function buildJavaProjectIndex(files: readonly SourceFileEntry[]): JavaProjectIndex {
  const byFqn = new Map<string, string>();
  const byPackage = new Map<string, string[]>();

  for (const file of files) {
    if (getCodeFileExtension(file.path) !== 'java') {
      continue;
    }

    const cleaned = stripCStyleComments(file.content);
    const packageMatch = cleaned.match(/\bpackage\s+([A-Za-z_][\w.]*)\s*;/);
    const packageName = packageMatch ? packageMatch[1] : '';

    const classNames = new Set<string>([getFileBaseName(file.path)]);
    const typeRegex =
      /\b(?:public\s+)?(?:abstract\s+|final\s+|sealed\s+|non-sealed\s+)?(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/g;
    let typeMatch = typeRegex.exec(cleaned);
    while (typeMatch !== null) {
      classNames.add(typeMatch[1]);
      typeMatch = typeRegex.exec(cleaned);
    }

    for (const className of classNames) {
      const fqn = packageName ? `${packageName}.${className}` : className;
      if (!byFqn.has(fqn)) {
        byFqn.set(fqn, file.path);
      }
    }

    if (packageName) {
      const existing = byPackage.get(packageName) ?? [];
      existing.push(file.path);
      byPackage.set(packageName, existing);
    }
  }

  return { byFqn, byPackage };
}

export function parseJavaDependencies(
  filePath: string,
  content: string,
  javaIndex: JavaProjectIndex
): string[] {
  const cleaned = stripCStyleComments(content);
  const targets = new Set<string>();

  const importRegex = /\bimport\s+(static\s+)?([A-Za-z_][\w.*]*)\s*;/g;
  let match = importRegex.exec(cleaned);

  while (match !== null) {
    const isStatic = Boolean(match[1]);
    const importPath = match[2];

    if (importPath.startsWith('java.') || importPath.startsWith('javax.')) {
      match = importRegex.exec(cleaned);
      continue;
    }

    if (importPath.endsWith('.*')) {
      const packagePrefix = importPath.slice(0, -2);
      const packageFiles = javaIndex.byPackage.get(packagePrefix) ?? [];
      for (const targetPath of packageFiles) {
        if (targetPath !== filePath) {
          targets.add(targetPath);
        }
      }

      if (isStatic) {
        const directTarget = javaIndex.byFqn.get(packagePrefix);
        if (directTarget && directTarget !== filePath) {
          targets.add(directTarget);
        }
      }
    } else {
      const directTarget = javaIndex.byFqn.get(importPath);
      if (directTarget && directTarget !== filePath) {
        targets.add(directTarget);
      } else if (isStatic) {
        const lastDot = importPath.lastIndexOf('.');
        if (lastDot > 0) {
          const owningClass = importPath.slice(0, lastDot);
          const staticTarget = javaIndex.byFqn.get(owningClass);
          if (staticTarget && staticTarget !== filePath) {
            targets.add(staticTarget);
          }
        }
      }
    }

    match = importRegex.exec(cleaned);
  }

  return Array.from(targets);
}
