import type {
  CodeGraph,
  GraphNodeData,
  ParsedRepoRef,
  RepoMetadata,
  SourceFileEntry,
} from '../types/graph';
import {
  getCodeFileExtension,
  getLanguageGroup,
  getLanguageLabel,
  resolveRepoDependencies,
} from './dependencyParser';
import { summarizeSourceFile } from './fileSummarizer';
import { analyzeDependencyGraph } from './graphAnalyzer';

/**
 * Parses either "owner/repo" or a full GitHub URL into owner and repo name.
 */
export function parseRepoInput(rawInput: string): ParsedRepoRef | null {
  const trimmed = rawInput.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
  if (!trimmed) {
    return null;
  }

  const githubUrlMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/.*)?$/i
  );
  if (githubUrlMatch) {
    return {
      owner: githubUrlMatch[1],
      name: githubUrlMatch[2],
    };
  }

  const slugMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slugMatch) {
    return {
      owner: slugMatch[1],
      name: slugMatch[2],
    };
  }

  return null;
}

function getFileName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

/**
 * Builds and analyzes a multi-language file dependency CodeGraph from downloaded source files.
 */
export function buildDependencyGraph(
  repo: RepoMetadata,
  files: readonly SourceFileEntry[]
): CodeGraph {
  const validFiles = files
    .filter((file) => getCodeFileExtension(file.path) !== null)
    .sort((a, b) => a.path.localeCompare(b.path));

  const baseNodes = validFiles.flatMap((file) => {
    const extension = getCodeFileExtension(file.path);
    if (!extension) {
      return [];
    }

    return [
      {
        id: file.path,
        label: getFileName(file.path),
        path: file.path,
        extension,
        languageGroup: getLanguageGroup(extension),
        languageLabel: getLanguageLabel(extension),
        fileSummary: summarizeSourceFile(file.path, file.content, extension),
        sizeBytes: file.sizeBytes,
      },
    ];
  });

  const rawEdges = resolveRepoDependencies(validFiles);
  const { nodes, edges, analysis } = analyzeDependencyGraph(baseNodes, rawEdges);

  return {
    repo,
    nodes,
    edges,
    analysis,
  };
}

function getSearchMatchRank(node: GraphNodeData, normalizedQuery: string): number {
  const lowerLabel = node.label.toLowerCase();
  const lowerPath = node.path.toLowerCase();

  if (lowerLabel === normalizedQuery) {
    return 0;
  }
  if (lowerLabel.startsWith(normalizedQuery)) {
    return 1;
  }
  if (lowerLabel.includes(normalizedQuery)) {
    return 2;
  }
  if (lowerPath.includes(normalizedQuery)) {
    return 3;
  }
  return -1;
}

/**
 * Returns nodes matching the search query ordered by relevance (filename match before path match).
 */
export function findMatchingNodes(
  nodes: readonly GraphNodeData[],
  query: string
): GraphNodeData[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return nodes
    .map((node) => ({
      node,
      rank: getSearchMatchRank(node, normalizedQuery),
    }))
    .filter((item) => item.rank >= 0)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.node.inDegree - a.node.inDegree ||
        a.node.path.localeCompare(b.node.path)
    )
    .map((item) => item.node);
}
