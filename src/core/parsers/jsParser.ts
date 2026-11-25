import type { CodeFileExtension } from '../../types/graph';
import {
  getParentDirectorySegments,
  normalizePosixPath,
  stripCStyleComments,
} from './pathUtils';

const JS_EXTENSION_ORDER: readonly CodeFileExtension[] = ['ts', 'tsx', 'js', 'jsx'];

export function extractJsImportSpecifiers(sourceCode: string): string[] {
  const cleaned = stripCStyleComments(sourceCode);
  const specifiers = new Set<string>();

  const patterns: RegExp[] = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(cleaned);
    while (match !== null) {
      const specifier = match[1].trim();
      if (specifier.length > 0) {
        specifiers.add(specifier);
      }
      match = pattern.exec(cleaned);
    }
  }

  return Array.from(specifiers);
}

export function resolveJsRelativeImport(
  fromFilePath: string,
  specifier: string,
  availableFilePaths: ReadonlySet<string>
): string | null {
  if (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    specifier !== '.' &&
    specifier !== '..'
  ) {
    return null;
  }

  const fromDir = getParentDirectorySegments(fromFilePath);
  const cleanSpecifier = specifier.split('?')[0].split('#')[0];
  const normalizedTarget = normalizePosixPath([...fromDir, ...cleanSpecifier.split('/')]);

  if (!normalizedTarget) {
    return null;
  }

  if (availableFilePaths.has(normalizedTarget)) {
    return normalizedTarget;
  }

  if (normalizedTarget.endsWith('.js') || normalizedTarget.endsWith('.jsx')) {
    const withoutJsExt = normalizedTarget.replace(/\.jsx?$/i, '');
    for (const ext of JS_EXTENSION_ORDER) {
      const candidate = `${withoutJsExt}.${ext}`;
      if (availableFilePaths.has(candidate)) {
        return candidate;
      }
    }
  }

  for (const ext of JS_EXTENSION_ORDER) {
    const candidate = `${normalizedTarget}.${ext}`;
    if (availableFilePaths.has(candidate)) {
      return candidate;
    }
  }

  for (const ext of JS_EXTENSION_ORDER) {
    const indexCandidate = `${normalizedTarget}/index.${ext}`;
    if (availableFilePaths.has(indexCandidate)) {
      return indexCandidate;
    }
  }

  return null;
}

export function parseJsDependencies(
  filePath: string,
  content: string,
  availableFilePaths: ReadonlySet<string>
): string[] {
  const targets = new Set<string>();
  const specifiers = extractJsImportSpecifiers(content);

  for (const specifier of specifiers) {
    const resolved = resolveJsRelativeImport(filePath, specifier, availableFilePaths);
    if (resolved !== null && resolved !== filePath) {
      targets.add(resolved);
    }
  }

  return Array.from(targets);
}
