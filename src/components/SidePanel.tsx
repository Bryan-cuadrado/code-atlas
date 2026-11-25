import type { AppError, CodeGraph, ExportFormat, GraphNodeData } from '../types/graph';

interface SidePanelProps {
  graph: CodeGraph | null;
  selectedNode: GraphNodeData | null;
  error: AppError | null;
  onSelectNode: (node: GraphNodeData) => void;
  onExportReport: (format: ExportFormat) => void;
  onDismissError: () => void;
}

export function SidePanel({
  graph,
  selectedNode,
  error,
  onSelectNode,
  onExportReport,
  onDismissError,
}: SidePanelProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3.5 overflow-y-auto border-t border-zinc-800/80 bg-zinc-950 p-4 lg:w-96 lg:border-t-0 lg:border-l">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold uppercase tracking-wide text-amber-300">
              {error.kind === 'rate_limit'
                ? 'Límite de API (403)'
                : error.kind === 'unauthorized'
                  ? 'Token inválido (401)'
                  : 'Aviso'}
            </span>
            <button
              type="button"
              onClick={onDismissError}
              className="cursor-pointer text-amber-300/80 hover:text-amber-100"
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
          <p className="mt-1.5 leading-relaxed">{error.message}</p>
        </div>
      )}

      <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Repositorio
        </h2>
        {graph ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-zinc-100">
                {graph.repo.fullName}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {graph.repo.fromCache && (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    CACHÉ
                  </span>
                )}
                {graph.repo.isDemo && (
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                    DEMO
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">{graph.repo.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span>Rama: {graph.repo.defaultBranch}</span>
              {graph.repo.analyzedFilesLimitReached && (
                <span className="text-amber-400">
                  Límite aplicado: {graph.repo.maxCodeFilesLimit ?? 100} de{' '}
                  {graph.repo.totalCodeFilesInRepo} archivos
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Ningún repositorio cargado.</p>
        )}
      </section>

      {graph && (
        <>
          <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Métricas de Dependencias
              </h2>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                <dt className="text-zinc-500">Archivos</dt>
                <dd className="mt-0.5 text-sm font-semibold text-zinc-100">
                  {graph.analysis.totalFiles}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                <dt className="text-zinc-500">Imports</dt>
                <dd className="mt-0.5 text-sm font-semibold text-zinc-100">
                  {graph.analysis.totalEdges}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                <dt className="text-zinc-500">Ciclos</dt>
                <dd className="mt-0.5 text-sm font-semibold text-red-400">
                  {graph.analysis.cycleCount}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                <dt className="text-zinc-500">Huérfanos</dt>
                <dd className="mt-0.5 text-sm font-semibold text-amber-400">
                  {graph.analysis.orphanCount}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onExportReport('markdown')}
                className="cursor-pointer rounded-md border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25"
              >
                Exportar Reporte (.md)
              </button>
              <button
                type="button"
                onClick={() => onExportReport('json')}
                className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
              >
                Exportar JSON
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Ciclos Detectados ({graph.analysis.cycles.length})
            </h2>
            {graph.analysis.cycles.length > 0 ? (
              <ul className="mt-2 space-y-2 text-xs">
                {graph.analysis.cycles.map((cycle) => (
                  <li
                    key={cycle.id}
                    className="rounded border border-red-500/30 bg-red-500/10 p-2 font-mono text-[11px] leading-relaxed text-red-200"
                  >
                    {cycle.nodePaths.join(' → ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">No se detectaron dependencias circulares.</p>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Archivos Críticos ({graph.analysis.criticalFiles.length})
            </h2>
            {graph.analysis.criticalFiles.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-xs">
                {graph.analysis.criticalFiles.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNode(file)}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-left transition hover:border-indigo-500/50 hover:bg-zinc-900"
                    >
                      <span className="truncate font-mono text-[11px] text-zinc-200">
                        {file.path}
                      </span>
                      <span className="shrink-0 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                        in: {file.inDegree}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                Ningún archivo tiene 2 o más importaciones entrantes.
              </p>
            )}
          </section>

          {graph.analysis.orphanFiles.length > 0 && (
            <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Archivos Huérfanos ({graph.analysis.orphanFiles.length})
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs">
                {graph.analysis.orphanFiles.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNode(file)}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded border border-amber-500/25 bg-zinc-950/60 px-2.5 py-1.5 text-left transition hover:border-amber-500/50"
                    >
                      <span className="truncate font-mono text-[11px] text-amber-200">
                        {file.path}
                      </span>
                      <span className="shrink-0 text-[10px] text-amber-400">0 refs</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Nodo Seleccionado
        </h2>
        {selectedNode ? (
          <dl className="mt-2.5 space-y-2 text-xs">
            <div>
              <dt className="text-zinc-500">Archivo</dt>
              <dd className="break-all font-mono text-zinc-100">{selectedNode.path}</dd>
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <dt className="text-zinc-500">Lenguaje</dt>
                <dd className="text-zinc-200">{selectedNode.languageLabel}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Rol</dt>
                <dd className="text-indigo-300">{selectedNode.fileSummary.role}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Líneas</dt>
                <dd className="text-zinc-200">{selectedNode.fileSummary.lineCount}</dd>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <dt className="text-zinc-500">In-degree</dt>
                <dd className="font-semibold text-indigo-300">{selectedNode.inDegree}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Out-degree</dt>
                <dd className="font-semibold text-emerald-300">{selectedNode.outDegree}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Extensión</dt>
                <dd className="font-mono text-zinc-200">.{selectedNode.extension}</dd>
              </div>
            </div>
            <div>
              <dt className="text-zinc-500">Resumen</dt>
              <dd className="mt-0.5 leading-relaxed text-zinc-300">
                {selectedNode.fileSummary.summary}
              </dd>
            </div>
            {(selectedNode.isCritical || selectedNode.inCycle || selectedNode.isOrphan) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedNode.isCritical && (
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                    Crítico
                  </span>
                )}
                {selectedNode.inCycle && (
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                    En ciclo
                  </span>
                )}
                {selectedNode.isOrphan && (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                    Huérfano
                  </span>
                )}
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Haz clic sobre un nodo del grafo o archivo listado para ver sus métricas.
          </p>
        )}
      </section>
    </aside>
  );
}
