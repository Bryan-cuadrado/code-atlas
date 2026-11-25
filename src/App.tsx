import { useCallback, useMemo, useState } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { HeaderBar } from './components/HeaderBar';
import { SidePanel } from './components/SidePanel';
import {
  buildDependencyGraph,
  findMatchingNodes,
  parseRepoInput,
} from './core/graphBuilder';
import {
  buildExportFileName,
  formatAnalysisAsJson,
  formatAnalysisAsMarkdown,
} from './core/reportExporter';
import { DEMO_REPO_METADATA, DEMO_SOURCE_FILES } from './data/demoRepo';
import { analyzeGitHubRepository, GitHubApiError } from './services/githubApi';
import type { AppError, CodeGraph, ExportFormat, GraphNodeData } from './types/graph';

function triggerFileDownload(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export function App() {
  const [repoInput, setRepoInput] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [graph, setGraph] = useState<CodeGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const matchingNodes = useMemo(() => {
    if (!graph) {
      return [];
    }
    return findMatchingNodes(graph.nodes, searchQuery);
  }, [graph, searchQuery]);

  const matchedNode = matchingNodes[0] ?? null;

  const handleSearchQueryChange = useCallback(
    (nextQuery: string) => {
      setSearchQuery(nextQuery);
      if (!graph || !nextQuery.trim()) {
        return;
      }
      const matches = findMatchingNodes(graph.nodes, nextQuery);
      if (matches.length > 0) {
        setSelectedNode(matches[0]);
      }
    },
    [graph]
  );

  const handleFitGraph = useCallback(() => {
    setFitTrigger((prev) => prev + 1);
  }, []);

  const handleLoadDemo = useCallback(() => {
    setError(null);
    setSelectedNode(null);
    setSearchQuery('');
    const demoGraph = buildDependencyGraph(DEMO_REPO_METADATA, DEMO_SOURCE_FILES);
    setGraph(demoGraph);
    setRepoInput(DEMO_REPO_METADATA.fullName);
  }, []);

  const handleAnalyzeSubmit = useCallback(async () => {
    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      setError({
        kind: 'invalid_input',
        message: 'Formato inválido. Usa "propietario/repositorio" o una URL válida de GitHub.',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedNode(null);
    setSearchQuery('');

    try {
      const nextGraph = await analyzeGitHubRepository(parsed, githubToken);
      setGraph(nextGraph);
    } catch (caughtError: unknown) {
      if (caughtError instanceof GitHubApiError) {
        setError(caughtError.appError);
      } else {
        setError({
          kind: 'unknown',
          message: 'Ocurrió un error inesperado al analizar el repositorio.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [repoInput, githubToken]);

  const handleExportReport = useCallback(
    (format: ExportFormat) => {
      if (!graph) {
        return;
      }
      const exportedAtIso = new Date().toISOString();
      const fileName = buildExportFileName(graph.repo.fullName, format);

      if (format === 'json') {
        const jsonContent = formatAnalysisAsJson(graph, exportedAtIso);
        triggerFileDownload(fileName, jsonContent, 'application/json;charset=utf-8');
        return;
      }

      const markdownContent = formatAnalysisAsMarkdown(graph, exportedAtIso);
      triggerFileDownload(fileName, markdownContent, 'text/markdown;charset=utf-8');
    },
    [graph]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <HeaderBar
        repoInput={repoInput}
        githubToken={githubToken}
        isLoading={isLoading}
        onRepoInputChange={setRepoInput}
        onGithubTokenChange={setGithubToken}
        onAnalyzeSubmit={() => {
          void handleAnalyzeSubmit();
        }}
        onLoadDemo={handleLoadDemo}
      />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-0 flex-1">
          <GraphCanvas
            graph={graph}
            selectedNodeId={selectedNode?.id ?? null}
            searchQuery={searchQuery}
            matchedNodeId={matchedNode?.id ?? null}
            matchCount={matchingNodes.length}
            fitTrigger={fitTrigger}
            onSearchQueryChange={handleSearchQueryChange}
            onFitGraph={handleFitGraph}
            onSelectNode={setSelectedNode}
            onLoadDemo={handleLoadDemo}
          />
        </section>

        <SidePanel
          graph={graph}
          selectedNode={selectedNode}
          error={error}
          onSelectNode={setSelectedNode}
          onExportReport={handleExportReport}
          onDismissError={() => setError(null)}
        />
      </main>
    </div>
  );
}

export default App;
