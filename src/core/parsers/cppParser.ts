import {
  getParentDirectorySegments,
  normalizePosixPath,
  stripCStyleComments,
} from './pathUtils';

function resolveLocalInclude(
  fromFilePath: string,
  includePath: string,
  availableFilePaths: ReadonlySet<string>
): string | null {
  const fromDir = getParentDirectorySegments(fromFilePath);
  const relativeCandidate = normalizePosixPath([...fromDir, ...includePath.split('/')]);
  if (relativeCandidate && availableFilePaths.has(relativeCandidate)) {
    return relativeCandidate;
  }

  const rootCandidate = normalizePosixPath(includePath.split('/'));
  if (!rootCandidate) {
    return null;
  }

  if (availableFilePaths.has(rootCandidate)) {
    return rootCandidate;
  }

  for (const prefix of ['include', 'src']) {
    const prefixed = `${prefix}/${rootCandidate}`;
    if (availableFilePaths.has(prefixed)) {
      return prefixed;
    }
  }

  const suffix = `/${rootCandidate}`;
  for (const availablePath of availableFilePaths) {
    if (availablePath.endsWith(suffix)) {
      return availablePath;
    }
  }

  return null;
}

export function parseCppDependencies(
  filePath: string,
  content: string,
  availableFilePaths: ReadonlySet<string>
): string[] {
  const cleaned = stripCStyleComments(content);
  const targets = new Set<string>();

  // Only match local #include "..." directives; system #include <...> is intentionally ignored.
  const includeRegex = /^\s*#\s*include\s*"([^"]+)"/gm;
  let match = includeRegex.exec(cleaned);

  while (match !== null) {
    const includeSpec = match[1].trim();
    if (includeSpec.length > 0) {
      const resolved = resolveLocalInclude(filePath, includeSpec, availableFilePaths);
      if (resolved !== null && resolved !== filePath) {
        targets.add(resolved);
      }
    }
    match = includeRegex.exec(cleaned);
  }

  return Array.from(targets);
}
