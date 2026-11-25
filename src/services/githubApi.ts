import { isSupportedCodeFile } from '../core/dependencyParser';
import type {
  AppError,
  ParsedRepoRef,
  RepoMetadata,
  SourceFileEntry,
} from '../types/graph';

const MAX_CODE_FILES = 100;
const BLOB_FETCH_CONCURRENCY = 8;

interface GitHubRepoApiResponse {
  name: string;
  full_name: string;
  default_branch: string;
  description: string | null;
  owner: {
    login: string;
  };
}

interface GitHubTreeApiItem {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

interface GitHubTreeApiResponse {
  tree: GitHubTreeApiItem[];
  truncated: boolean;
}

export class GitHubApiError extends Error {
  public readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'GitHubApiError';
    this.appError = appError;
  }
}

function buildHeaders(accept: string, token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
  };
  const trimmedToken = token?.trim();
  if (trimmedToken) {
    headers.Authorization = `Bearer ${trimmedToken}`;
  }
  return headers;
}

function buildRateLimitError(response: Response): GitHubApiError {
  const resetHeader = response.headers.get('x-ratelimit-reset');
  let resetMessage =
    'Límite de solicitudes de GitHub alcanzado (HTTP 403). Agrega un Personal Access Token opcional o usa "Probar con Repo Demo".';
  let resetAtIso: string | undefined;

  if (resetHeader) {
    const resetEpochSeconds = Number(resetHeader);
    if (Number.isFinite(resetEpochSeconds) && resetEpochSeconds > 0) {
      const resetDate = new Date(resetEpochSeconds * 1000);
      resetAtIso = resetDate.toISOString();
      const formattedTime = resetDate.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });
      resetMessage = `Límite de solicitudes de GitHub alcanzado (HTTP 403). Se restablece alrededor de las ${formattedTime}. Agrega un Personal Access Token o usa "Probar con Repo Demo".`;
    }
  }

  return new GitHubApiError({
    kind: 'rate_limit',
    message: resetMessage,
    resetAtIso,
  });
}

async function fetchGitHubResponse(
  url: string,
  accept: string,
  token?: string
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: buildHeaders(accept, token),
    });
  } catch {
    throw new GitHubApiError({
      kind: 'network',
      message:
        'No se pudo conectar con la API de GitHub. Verifica tu conexión o prueba con el Repo Demo.',
    });
  }

  if (response.status === 401) {
    throw new GitHubApiError({
      kind: 'unauthorized',
      message:
        'El Personal Access Token de GitHub no es válido o expiró (HTTP 401). Verifica el token o déjalo vacío.',
    });
  }

  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0' || remaining === null) {
      throw buildRateLimitError(response);
    }
    throw new GitHubApiError({
      kind: 'rate_limit',
      message:
        'GitHub rechazó la solicitud con HTTP 403 (límite de tasa o acceso restringido). Usa un token o "Probar con Repo Demo".',
    });
  }

  if (response.status === 404) {
    throw new GitHubApiError({
      kind: 'not_found',
      message: 'Repositorio no encontrado o privado. Verifica el formato propietario/repositorio.',
    });
  }

  if (!response.ok) {
    throw new GitHubApiError({
      kind: 'unknown',
      message: `Error inesperado de GitHub (HTTP ${response.status}).`,
    });
  }

  return response;
}

function isExcludedDirectory(path: string): boolean {
  return /(^|\/)(node_modules|dist|build|target|\.mvn|__pycache__|\.git)(\/|$)/i.test(path);
}

async function fetchBlobsWithConcurrency(
  owner: string,
  name: string,
  items: readonly GitHubTreeApiItem[],
  token?: string
): Promise<SourceFileEntry[]> {
  const results: SourceFileEntry[] = new Array<SourceFileEntry>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      const url = `https://api.github.com/repos/${owner}/${name}/git/blobs/${encodeURIComponent(item.sha)}`;
      const response = await fetchGitHubResponse(url, 'application/vnd.github.raw+json', token);
      const content = await response.text();
      results[currentIndex] = {
        path: item.path,
        content,
        sizeBytes: item.size,
      };
    }
  }

  const workerCount = Math.min(BLOB_FETCH_CONCURRENCY, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

export async function fetchGitHubCodeFiles(
  ref: ParsedRepoRef,
  token?: string
): Promise<{
  metadata: RepoMetadata;
  files: SourceFileEntry[];
}> {
  const encodedOwner = encodeURIComponent(ref.owner);
  const encodedName = encodeURIComponent(ref.name);

  const repoResponse = await fetchGitHubResponse(
    `https://api.github.com/repos/${encodedOwner}/${encodedName}`,
    'application/vnd.github+json',
    token
  );
  const repoData = (await repoResponse.json()) as GitHubRepoApiResponse;

  const encodedBranch = encodeURIComponent(repoData.default_branch);
  const treeResponse = await fetchGitHubResponse(
    `https://api.github.com/repos/${encodedOwner}/${encodedName}/git/trees/${encodedBranch}?recursive=1`,
    'application/vnd.github+json',
    token
  );
  const treeData = (await treeResponse.json()) as GitHubTreeApiResponse;

  const eligibleCodeItems = treeData.tree.filter(
    (item) =>
      item.type === 'blob' &&
      !isExcludedDirectory(item.path) &&
      isSupportedCodeFile(item.path)
  );

  const limitedItems = eligibleCodeItems.slice(0, MAX_CODE_FILES);
  const files =
    limitedItems.length > 0
      ? await fetchBlobsWithConcurrency(encodedOwner, encodedName, limitedItems, token)
      : [];

  const metadata: RepoMetadata = {
    owner: repoData.owner.login,
    name: repoData.name,
    fullName: repoData.full_name,
    defaultBranch: repoData.default_branch,
    description: repoData.description ?? 'Sin descripción disponible.',
    isDemo: false,
    totalCodeFilesInRepo: eligibleCodeItems.length,
    analyzedFilesLimitReached: eligibleCodeItems.length > MAX_CODE_FILES,
    maxCodeFilesLimit: MAX_CODE_FILES,
  };

  return { metadata, files };
}
