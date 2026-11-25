import {
  getParentDirectorySegments,
  normalizePosixPath,
  stripHtmlComments,
} from './pathUtils';

function isExternalResourceRef(ref: string): boolean {
  const lower = ref.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('data:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('#')
  );
}

function resolveHtmlAssetRef(
  fromFilePath: string,
  rawRef: string,
  availableFilePaths: ReadonlySet<string>
): string | null {
  const cleanRef = rawRef.trim().split('?')[0].split('#')[0];
  if (!cleanRef || isExternalResourceRef(cleanRef)) {
    return null;
  }

  if (cleanRef.startsWith('/')) {
    const rootRelative = normalizePosixPath(cleanRef.slice(1).split('/'));
    if (!rootRelative) {
      return null;
    }
    if (availableFilePaths.has(rootRelative)) {
      return rootRelative;
    }
    const publicCandidate = `public/${rootRelative}`;
    if (availableFilePaths.has(publicCandidate)) {
      return publicCandidate;
    }
    return null;
  }

  const fromDir = getParentDirectorySegments(fromFilePath);
  const relativeCandidate = normalizePosixPath([...fromDir, ...cleanRef.split('/')]);
  if (relativeCandidate && availableFilePaths.has(relativeCandidate)) {
    return relativeCandidate;
  }

  return null;
}

export function parseHtmlDependencies(
  filePath: string,
  content: string,
  availableFilePaths: ReadonlySet<string>
): string[] {
  const cleaned = stripHtmlComments(content);
  const targets = new Set<string>();

  const patterns: RegExp[] = [
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
    /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(cleaned);
    while (match !== null) {
      const resolved = resolveHtmlAssetRef(filePath, match[1], availableFilePaths);
      if (resolved !== null && resolved !== filePath) {
        targets.add(resolved);
      }
      match = pattern.exec(cleaned);
    }
  }

  return Array.from(targets);
}
