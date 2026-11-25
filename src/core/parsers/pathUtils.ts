import type { CodeFileExtension, LanguageGroup } from '../../types/graph';

const EXTENSION_MAP: Readonly<Record<string, CodeFileExtension>> = {
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.java': 'java',
  '.py': 'py',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'h',
  '.hpp': 'hpp',
  '.html': 'html',
  '.css': 'css',
};

const LANGUAGE_GROUP_MAP: Readonly<Record<CodeFileExtension, LanguageGroup>> = {
  js: 'jsts',
  jsx: 'jsts',
  ts: 'jsts',
  tsx: 'jsts',
  java: 'java',
  py: 'python',
  c: 'cpp',
  cpp: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  html: 'web',
  css: 'web',
};

const LANGUAGE_LABEL_MAP: Readonly<Record<CodeFileExtension, string>> = {
  js: 'JavaScript',
  jsx: 'JavaScript (JSX)',
  ts: 'TypeScript',
  tsx: 'TypeScript (TSX)',
  java: 'Java',
  py: 'Python',
  c: 'C',
  cpp: 'C++',
  h: 'C/C++ Header',
  hpp: 'C++ Header',
  html: 'HTML',
  css: 'CSS',
};

export function getCodeFileExtension(filePath: string): CodeFileExtension | null {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith('.d.ts')) {
    return null;
  }

  for (const [suffix, ext] of Object.entries(EXTENSION_MAP)) {
    if (normalized.endsWith(suffix)) {
      return ext;
    }
  }

  return null;
}

export function isSupportedCodeFile(filePath: string): boolean {
  return getCodeFileExtension(filePath) !== null;
}

export function getLanguageGroup(ext: CodeFileExtension): LanguageGroup {
  return LANGUAGE_GROUP_MAP[ext];
}

export function getLanguageLabel(ext: CodeFileExtension): string {
  return LANGUAGE_LABEL_MAP[ext];
}

export function normalizePosixPath(segments: readonly string[]): string | null {
  const stack: string[] = [];

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (stack.length === 0) {
        return null;
      }
      stack.pop();
    } else {
      stack.push(segment);
    }
  }

  return stack.join('/');
}

export function getParentDirectorySegments(filePath: string): string[] {
  const segments = filePath.split('/').filter((segment) => segment.length > 0);
  segments.pop();
  return segments;
}

export function stripCStyleComments(source: string): string {
  let result = '';
  let index = 0;
  const length = source.length;

  while (index < length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      result += char;
      index += 1;
      while (index < length) {
        const inner = source[index];
        result += inner;
        if (inner === '\\' && index + 1 < length) {
          index += 1;
          result += source[index];
        } else if (inner === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      index += 2;
      while (index < length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') {
          result += '\n';
        }
        index += 1;
      }
      index += 2;
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

export function stripHashComments(source: string): string {
  let result = '';
  let index = 0;
  const length = source.length;

  while (index < length) {
    const char = source[index];

    if (char === "'" || char === '"') {
      const isTriple = source[index + 1] === char && source[index + 2] === char;
      const quote = char;
      if (isTriple) {
        result += source.slice(index, index + 3);
        index += 3;
        while (index < length) {
          if (source[index] === '\\' && index + 1 < length) {
            result += source.slice(index, index + 2);
            index += 2;
            continue;
          }
          if (
            source[index] === quote &&
            source[index + 1] === quote &&
            source[index + 2] === quote
          ) {
            result += source.slice(index, index + 3);
            index += 3;
            break;
          }
          result += source[index];
          index += 1;
        }
      } else {
        result += char;
        index += 1;
        while (index < length) {
          const inner = source[index];
          result += inner;
          if (inner === '\\' && index + 1 < length) {
            index += 1;
            result += source[index];
          } else if (inner === quote || inner === '\n') {
            index += 1;
            break;
          }
          index += 1;
        }
      }
      continue;
    }

    if (char === '#') {
      while (index < length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

export function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, '');
}
