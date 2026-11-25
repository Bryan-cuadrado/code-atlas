import type { CodeFileExtension, FileSummary } from '../types/graph';
import { stripCStyleComments, stripHashComments } from './parsers/pathUtils';

const MAX_HIGHLIGHTS = 3;
const MAX_COMMENT_LENGTH = 170;

const IGNORED_IDENTIFIER_KEYWORDS = new Set<string>([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'sizeof',
  'typeof',
  'new',
  'else',
]);

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r\n|\r|\n/).length;
}

function cleanCommentText(rawText: string): string {
  const cleaned = rawText
    .replace(/^\s*\/\*\*?/, '')
    .replace(/\*\/\s*$/, '')
    .replace(/^\s*<!--/, '')
    .replace(/-->\s*$/, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(\*|\/\/|#)\s?/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= MAX_COMMENT_LENGTH) {
    return cleaned;
  }
  return `${cleaned.slice(0, MAX_COMMENT_LENGTH - 1).trimEnd()}…`;
}

function extractLeadingHeaderComment(
  content: string,
  ext: CodeFileExtension
): string | null {
  const trimmed = content.trimStart();

  if (ext === 'html') {
    const htmlCommentMatch = trimmed.match(/^<!--([\s\S]*?)-->/);
    if (htmlCommentMatch) {
      const cleaned = cleanCommentText(htmlCommentMatch[1]);
      return cleaned.length > 0 ? cleaned : null;
    }
    return null;
  }

  if (ext === 'py') {
    const withoutShebang = trimmed.replace(/^#![^\n]*\n?/, '').trimStart();
    const docstringMatch = withoutShebang.match(/^(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
    if (docstringMatch) {
      const rawDoc = docstringMatch[1] ?? docstringMatch[2] ?? '';
      const cleaned = cleanCommentText(rawDoc);
      return cleaned.length > 0 ? cleaned : null;
    }
    const hashBlockMatch = withoutShebang.match(/^(?:#[^\n]*(?:\r?\n|$))+/);
    if (hashBlockMatch) {
      const cleaned = cleanCommentText(hashBlockMatch[0]);
      return cleaned.length > 0 ? cleaned : null;
    }
    return null;
  }

  // C-style languages (JS/TS, Java, C/C++, CSS)
  const blockMatch = trimmed.match(/^\/\*([\s\S]*?)\*\//);
  if (blockMatch) {
    const cleaned = cleanCommentText(blockMatch[1]);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  const lineCommentMatch = trimmed.match(/^(?:\/\/[^\n]*(?:\r?\n|$))+/);
  if (lineCommentMatch) {
    const cleaned = cleanCommentText(lineCommentMatch[0]);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  // Fallback for Java/TS files where package/imports precede the first Javadoc/block comment
  const firstDocComment = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (firstDocComment) {
    const cleaned = cleanCommentText(firstDocComment[1]);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  return null;
}

function addUniqueHighlight(target: string[], item: string): void {
  if (target.length >= MAX_HIGHLIGHTS) {
    return;
  }
  if (!target.includes(item)) {
    target.push(item);
  }
}

function summarizeJava(filePath: string, content: string, headerComment: string | null): {
  role: string;
  highlights: string[];
  summary: string;
} {
  const cleaned = stripCStyleComments(content);
  const highlights: string[] = [];

  const typeRegex = /\b(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/g;
  let typeMatch = typeRegex.exec(cleaned);
  while (typeMatch !== null && highlights.length < MAX_HIGHLIGHTS) {
    addUniqueHighlight(highlights, typeMatch[1]);
    typeMatch = typeRegex.exec(cleaned);
  }

  const methodRegex =
    /\b(?:public|protected|private)\s+(?:static\s+)?(?:[\w<>\[\], ?]+\s+)([A-Za-z_]\w*)\s*\([^)]*\)\s*(?:throws\s+[\w., ]+)?\{/g;
  let methodMatch = methodRegex.exec(cleaned);
  while (methodMatch !== null && highlights.length < MAX_HIGHLIGHTS) {
    const methodName = methodMatch[1];
    if (!IGNORED_IDENTIFIER_KEYWORDS.has(methodName)) {
      addUniqueHighlight(highlights, `${methodName}()`);
    }
    methodMatch = methodRegex.exec(cleaned);
  }

  let role = 'Clase / Módulo Java';
  if (
    /HttpServlet|@WebServlet|@RestController|@Controller|@RequestMapping|@GetMapping|@PostMapping|\bdoGet\s*\(|\bdoPost\s*\(/.test(
      cleaned
    )
  ) {
    role = 'Servlet / Controlador';
  } else if (
    /\b(Connection|PreparedStatement|ResultSet|DriverManager|EntityManager|JdbcTemplate)\b|@Repository|\bSELECT\s+.+\s+FROM\b/i.test(
      cleaned
    ) ||
    /DAO\.java$/i.test(filePath)
  ) {
    role = 'Acceso a BD / DAO';
  } else if (/@Service\b/.test(cleaned) || /Service\.java$/i.test(filePath)) {
    role = 'Servicio / Lógica Java';
  } else if (
    /@Entity\b|@Table\b|\brecord\s+[A-Za-z_]/.test(cleaned) ||
    /(model|entity|dto)/i.test(filePath)
  ) {
    role = 'Modelo / Entidad';
  }

  const summary =
    headerComment ??
    (highlights.length > 0
      ? `${role} que define ${highlights.join(', ')}.`
      : `${role} escrito en Java.`);

  return { role, highlights, summary };
}

function summarizeJsTs(
  filePath: string,
  content: string,
  ext: CodeFileExtension,
  headerComment: string | null
): {
  role: string;
  highlights: string[];
  summary: string;
} {
  const cleaned = stripCStyleComments(content);
  const highlights: string[] = [];

  const declarationPatterns: RegExp[] = [
    /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/g,
    /\b(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)\b/g,
    /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
  ];

  for (const pattern of declarationPatterns) {
    let match = pattern.exec(cleaned);
    while (match !== null && highlights.length < MAX_HIGHLIGHTS) {
      addUniqueHighlight(highlights, match[1]);
      match = pattern.exec(cleaned);
    }
  }

  let role = 'Módulo JS/TS';
  if (
    ext === 'jsx' ||
    ext === 'tsx' ||
    /\b(useState|useEffect|useCallback|useMemo|createRoot)\b|<[A-Z][A-Za-z0-9]*/.test(cleaned)
  ) {
    role = 'Componente React / UI';
  } else if (/\b(fetch|axios|XMLHttpRequest)\b|api\.github\.com/.test(cleaned)) {
    role = 'Consumo API / Fetch';
  } else if (
    /\b(document|window)\.(querySelector|getElementById|createElement|addEventListener)|innerHTML/.test(
      cleaned
    )
  ) {
    role = 'Manipulación DOM';
  } else if (
    /\bexport\s+(?:interface|type)\b/.test(cleaned) &&
    !/\bfunction\b|=>|\bclass\b/.test(cleaned)
  ) {
    role = 'Definición de Tipos';
  } else if (/(util|helper|format|logger|parser)/i.test(filePath)) {
    role = 'Módulo de Utilidades';
  } else if (/(service|client|store)/i.test(filePath)) {
    role = 'Servicio / Estado';
  }

  const summary =
    headerComment ??
    (highlights.length > 0
      ? `${role} con ${highlights.join(', ')}.`
      : `${role} en el proyecto.`);

  return { role, highlights, summary };
}

function summarizePython(content: string, headerComment: string | null): {
  role: string;
  highlights: string[];
  summary: string;
} {
  const cleaned = stripHashComments(content);
  const highlights: string[] = [];

  const classRegex = /^\s*class\s+([A-Za-z_]\w*)/gm;
  let classMatch = classRegex.exec(cleaned);
  while (classMatch !== null && highlights.length < MAX_HIGHLIGHTS) {
    addUniqueHighlight(highlights, `class ${classMatch[1]}`);
    classMatch = classRegex.exec(cleaned);
  }

  const defRegex = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm;
  let defMatch = defRegex.exec(cleaned);
  while (defMatch !== null && highlights.length < MAX_HIGHLIGHTS) {
    addUniqueHighlight(highlights, `def ${defMatch[1]}()`);
    defMatch = defRegex.exec(cleaned);
  }

  let role = 'Módulo Python';
  if (/@(?:app|router)\.(get|post|put|delete|route)\b|\b(FastAPI|Flask|APIRouter)\b/.test(cleaned)) {
    role = 'API / Controlador Python';
  } else if (/\b(sqlite3|sqlalchemy|Session|Base|Model)\b/i.test(cleaned)) {
    role = 'Modelo / Acceso a BD';
  } else if (/if\s+__name__\s*==\s*['"]__main__['"]/.test(cleaned)) {
    role = 'Script / Punto de Entrada';
  }

  const summary =
    headerComment ??
    (highlights.length > 0
      ? `${role} que define ${highlights.join(', ')}.`
      : `${role} sin símbolos principales detectados.`);

  return { role, highlights, summary };
}

function summarizeCpp(
  ext: CodeFileExtension,
  content: string,
  headerComment: string | null
): {
  role: string;
  highlights: string[];
  summary: string;
} {
  const cleaned = stripCStyleComments(content);
  const highlights: string[] = [];

  const typeRegex = /\b(?:class|struct)\s+([A-Za-z_]\w*)\s*(?:\{|:)/g;
  let typeMatch = typeRegex.exec(cleaned);
  while (typeMatch !== null && highlights.length < MAX_HIGHLIGHTS) {
    addUniqueHighlight(highlights, typeMatch[1]);
    typeMatch = typeRegex.exec(cleaned);
  }

  const fnRegex =
    /^\s*(?:[\w:*&<>]+\s+)+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)?)\s*\([^;{}]*\)\s*(?:const\s*)?\{/gm;
  let fnMatch = fnRegex.exec(cleaned);
  while (fnMatch !== null && highlights.length < MAX_HIGHLIGHTS) {
    const fnName = fnMatch[1];
    if (!IGNORED_IDENTIFIER_KEYWORDS.has(fnName)) {
      addUniqueHighlight(highlights, `${fnName}()`);
    }
    fnMatch = fnRegex.exec(cleaned);
  }

  let role = 'Módulo C/C++';
  if (ext === 'h' || ext === 'hpp') {
    role = 'Archivo de Cabecera';
  } else if (/\bint\s+main\s*\(/.test(cleaned)) {
    role = 'Punto de Entrada (main)';
  }

  const summary =
    headerComment ??
    (highlights.length > 0
      ? `${role} que declara ${highlights.join(', ')}.`
      : `${role}.`);

  return { role, highlights, summary };
}

function summarizeHtml(content: string, headerComment: string | null): {
  role: string;
  highlights: string[];
  summary: string;
} {
  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
  const formCount = (content.match(/<form\b/gi) ?? []).length;
  const scriptCount = (content.match(/<script\b/gi) ?? []).length;

  const highlights: string[] = [];
  if (pageTitle) {
    addUniqueHighlight(highlights, `Título: ${pageTitle}`);
  }
  addUniqueHighlight(highlights, `${formCount} formulario(s)`);
  addUniqueHighlight(highlights, `${scriptCount} script(s)`);

  const role = formCount > 0 ? 'Formulario / Vista HTML' : 'Documento HTML';
  const titlePart = pageTitle ? `Título "${pageTitle}". ` : '';
  const statsPart = `Contiene ${formCount} <form> y ${scriptCount} <script>.`;
  const summary = headerComment ? `${headerComment} (${statsPart})` : `${titlePart}${statsPart}`;

  return { role, highlights, summary };
}

function summarizeCss(content: string, headerComment: string | null): {
  role: string;
  highlights: string[];
  summary: string;
} {
  const cleaned = stripCStyleComments(content);
  const highlights: string[] = [];

  const selectorRegex = /^\s*([.#@]?[A-Za-z_-][\w-]*)\s*(?:,|\{)/gm;
  let match = selectorRegex.exec(cleaned);
  while (match !== null && highlights.length < MAX_HIGHLIGHTS) {
    addUniqueHighlight(highlights, match[1]);
    match = selectorRegex.exec(cleaned);
  }

  const ruleCount = (cleaned.match(/\{/g) ?? []).length;
  const role = 'Hoja de Estilos CSS';
  const summary =
    headerComment ??
    `Define ${ruleCount} bloque(s) de reglas CSS${
      highlights.length > 0 ? ` (${highlights.join(', ')})` : ''
    }.`;

  return { role, highlights, summary };
}

export function summarizeSourceFile(
  filePath: string,
  content: string,
  extension: CodeFileExtension
): FileSummary {
  const lineCount = countLines(content);
  const headerComment = extractLeadingHeaderComment(content, extension);

  let result: { role: string; highlights: string[]; summary: string };

  switch (extension) {
    case 'java':
      result = summarizeJava(filePath, content, headerComment);
      break;
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      result = summarizeJsTs(filePath, content, extension, headerComment);
      break;
    case 'py':
      result = summarizePython(content, headerComment);
      break;
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      result = summarizeCpp(extension, content, headerComment);
      break;
    case 'html':
      result = summarizeHtml(content, headerComment);
      break;
    case 'css':
      result = summarizeCss(content, headerComment);
      break;
  }

  return {
    summary: result.summary,
    role: result.role,
    highlights: result.highlights,
    lineCount,
  };
}
