import {
  getParentDirectorySegments,
  normalizePosixPath,
  stripHashComments,
} from './pathUtils';

function resolveModuleCandidates(
  baseSegments: readonly string[],
  moduleParts: readonly string[],
  availableFilePaths: ReadonlySet<string>
): string | null {
  if (moduleParts.length === 0) {
    return null;
  }

  const normalized = normalizePosixPath([...baseSegments, ...moduleParts]);
  if (!normalized) {
    return null;
  }

  const directPy = `${normalized}.py`;
  if (availableFilePaths.has(directPy)) {
    return directPy;
  }

  const initPy = `${normalized}/__init__.py`;
  if (availableFilePaths.has(initPy)) {
    return initPy;
  }

  return null;
}

function resolveAbsolutePythonModule(
  moduleParts: readonly string[],
  availableFilePaths: ReadonlySet<string>
): string | null {
  const direct = resolveModuleCandidates([], moduleParts, availableFilePaths);
  if (direct) {
    return direct;
  }

  const srcPrefixed = resolveModuleCandidates(['src'], moduleParts, availableFilePaths);
  if (srcPrefixed) {
    return srcPrefixed;
  }

  const appPrefixed = resolveModuleCandidates(['app'], moduleParts, availableFilePaths);
  if (appPrefixed) {
    return appPrefixed;
  }

  return null;
}

export function parsePythonDependencies(
  filePath: string,
  content: string,
  availableFilePaths: ReadonlySet<string>
): string[] {
  const cleaned = stripHashComments(content);
  const targets = new Set<string>();
  const currentDir = getParentDirectorySegments(filePath);

  const importLineRegex = /^\s*import\s+([^\n;]+)/gm;
  let importMatch = importLineRegex.exec(cleaned);
  while (importMatch !== null) {
    const rawItems = importMatch[1].split(',');
    for (const rawItem of rawItems) {
      const moduleName = rawItem.trim().split(/\s+as\s+/)[0]?.trim();
      if (!moduleName) {
        continue;
      }
      const parts = moduleName.split('.').filter((part) => part.length > 0);
      const resolved = resolveAbsolutePythonModule(parts, availableFilePaths);
      if (resolved && resolved !== filePath) {
        targets.add(resolved);
      }
    }
    importMatch = importLineRegex.exec(cleaned);
  }

  const fromImportRegex = /^\s*from\s+(\.*(?:[A-Za-z_][\w.]*)?)\s+import\s+\(?([^)\n]+)\)?/gm;
  let fromMatch = fromImportRegex.exec(cleaned);
  while (fromMatch !== null) {
    const moduleSpec = fromMatch[1].trim();
    const importedNamesRaw = fromMatch[2].trim();
    const importedNames = importedNamesRaw
      .split(',')
      .map((item) => item.trim().split(/\s+as\s+/)[0]?.trim() ?? '')
      .filter((item) => item.length > 0 && item !== '*');

    const leadingDotsMatch = moduleSpec.match(/^(\.+)(.*)$/);
    if (leadingDotsMatch) {
      const dotCount = leadingDotsMatch[1].length;
      const remainder = leadingDotsMatch[2].trim();
      const upLevels = Math.max(0, dotCount - 1);
      const baseDir = upLevels > 0 ? currentDir.slice(0, Math.max(0, currentDir.length - upLevels)) : currentDir;
      const remainderParts = remainder
        ? remainder.split('.').filter((part) => part.length > 0)
        : [];

      if (remainderParts.length > 0) {
        const resolvedBase = resolveModuleCandidates(baseDir, remainderParts, availableFilePaths);
        if (resolvedBase && resolvedBase !== filePath) {
          targets.add(resolvedBase);
        }
      }

      for (const name of importedNames) {
        const resolvedSub = resolveModuleCandidates(
          baseDir,
          [...remainderParts, name],
          availableFilePaths
        );
        if (resolvedSub && resolvedSub !== filePath) {
          targets.add(resolvedSub);
        }
      }
    } else {
      const moduleParts = moduleSpec.split('.').filter((part) => part.length > 0);
      const resolvedBase = resolveAbsolutePythonModule(moduleParts, availableFilePaths);
      if (resolvedBase && resolvedBase !== filePath) {
        targets.add(resolvedBase);
      }

      for (const name of importedNames) {
        const resolvedSub = resolveAbsolutePythonModule(
          [...moduleParts, name],
          availableFilePaths
        );
        if (resolvedSub && resolvedSub !== filePath) {
          targets.add(resolvedSub);
        }
      }
    }

    fromMatch = fromImportRegex.exec(cleaned);
  }

  return Array.from(targets);
}
