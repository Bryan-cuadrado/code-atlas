import { useEffect, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { CodeGraph, GraphNodeData, LanguageGroup } from '../types/graph';

interface GraphCanvasProps {
  graph: CodeGraph | null;
  selectedNodeId: string | null;
  searchQuery: string;
  matchedNodeId: string | null;
  matchCount: number;
  fitTrigger: number;
  onSearchQueryChange: (query: string) => void;
  onFitGraph: () => void;
  onSelectNode: (node: GraphNodeData | null) => void;
  onLoadDemo: () => void;
}

interface TooltipState {
  node: GraphNodeData;
  x: number;
  y: number;
}

const LANGUAGE_BADGE_COLORS: Readonly<Record<LanguageGroup, string>> = {
  jsts: 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300',
  java: 'border-orange-400/50 bg-orange-400/10 text-orange-300',
  python: 'border-sky-400/50 bg-sky-400/10 text-sky-300',
  cpp: 'border-purple-400/50 bg-purple-400/10 text-purple-300',
  web: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300',
};

function getNodeVisualSize(inDegree: number): number {
  return 22 + Math.min(inDegree * 8, 42);
}

function toCytoscapeElements(graph: CodeGraph): ElementDefinition[] {
  const nodeElements: ElementDefinition[] = graph.nodes.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      path: node.path,
      extension: node.extension,
      languageGroup: node.languageGroup,
      languageLabel: node.languageLabel,
      fileSummary: node.fileSummary,
      sizeBytes: node.sizeBytes,
      inDegree: node.inDegree,
      outDegree: node.outDegree,
      isCritical: node.isCritical,
      isOrphan: node.isOrphan,
      inCycle: node.inCycle,
      visualSize: getNodeVisualSize(node.inDegree),
    },
  }));

  const edgeElements: ElementDefinition[] = graph.edges.map((edge) => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      isCycle: edge.isCycle,
    },
  }));

  return [...nodeElements, ...edgeElements];
}

function computeTooltipPosition(
  container: HTMLDivElement | null,
  rawX: number,
  rawY: number
): { x: number; y: number } {
  const tooltipWidth = 300;
  const tooltipHeight = 190;
  const offset = 14;

  if (!container) {
    return { x: rawX + offset, y: rawY + offset };
  }

  const maxX = Math.max(12, container.clientWidth - tooltipWidth - 12);
  const maxY = Math.max(12, container.clientHeight - tooltipHeight - 12);
  const x = rawX + offset > maxX ? Math.max(12, rawX - tooltipWidth - offset) : rawX + offset;
  const y = rawY + offset > maxY ? Math.max(12, rawY - tooltipHeight - offset) : rawY + offset;

  return { x, y };
}

export function GraphCanvas({
  graph,
  selectedNodeId,
  searchQuery,
  matchedNodeId,
  matchCount,
  fitTrigger,
  onSearchQueryChange,
  onFitGraph,
  onSelectNode,
  onLoadDemo,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    setTooltip(null);
    const container = containerRef.current;
    if (!container || !graph) {
      cyRef.current = null;
      return undefined;
    }

    const cy = cytoscape({
      container,
      elements: toCytoscapeElements(graph),
      minZoom: 0.2,
      maxZoom: 2.5,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#e4e4e7',
            'font-size': '11px',
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-background-color': '#09090b',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
            width: 'data(visualSize)',
            height: 'data(visualSize)',
            'background-color': '#18181b',
            'border-width': 3,
            'border-color': '#a1a1aa',
          },
        },
        {
          selector: 'node[languageGroup = "jsts"]',
          style: {
            'border-color': '#facc15',
          },
        },
        {
          selector: 'node[languageGroup = "java"]',
          style: {
            'border-color': '#fb923c',
          },
        },
        {
          selector: 'node[languageGroup = "python"]',
          style: {
            'border-color': '#38bdf8',
          },
        },
        {
          selector: 'node[languageGroup = "cpp"]',
          style: {
            'border-color': '#c084fc',
          },
        },
        {
          selector: 'node[languageGroup = "web"]',
          style: {
            'border-color': '#34d399',
          },
        },
        {
          selector: 'node[?inCycle]',
          style: {
            'background-color': '#450a0a',
          },
        },
        {
          selector: 'node[?isCritical]',
          style: {
            'background-color': '#4338ca',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'node[?isOrphan]',
          style: {
            'background-color': '#27272a',
            'border-style': 'dashed',
          },
        },
        {
          selector: 'node.search-dimmed',
          style: {
            opacity: 0.25,
          },
        },
        {
          selector: 'node.search-match',
          style: {
            opacity: 1,
            'border-width': 4.5,
            'border-color': '#22d3ee',
            'z-index': 20,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#f4f4f5',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.4,
            'line-color': '#3f3f46',
            'target-arrow-color': '#52525b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.85,
          },
        },
        {
          selector: 'edge.search-dimmed',
          style: {
            opacity: 0.18,
          },
        },
        {
          selector: 'edge[?isCycle]',
          style: {
            width: 2.6,
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'z-index': 10,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        padding: 44,
        nodeRepulsion: () => 8500,
        idealEdgeLength: () => 115,
        edgeElasticity: () => 100,
      },
    });

    cy.on('tap', 'node', (event) => {
      const nodeData = event.target.data() as GraphNodeData;
      onSelectNode(nodeData);
    });

    cy.on('tap', (event) => {
      if (event.target === cy) {
        onSelectNode(null);
      }
    });

    cy.on('mouseover', 'node', (event) => {
      const nodeData = event.target.data() as GraphNodeData;
      const pos = computeTooltipPosition(
        containerRef.current,
        event.renderedPosition.x,
        event.renderedPosition.y
      );
      setTooltip({ node: nodeData, x: pos.x, y: pos.y });
    });

    cy.on('mousemove', 'node', (event) => {
      const nodeData = event.target.data() as GraphNodeData;
      const pos = computeTooltipPosition(
        containerRef.current,
        event.renderedPosition.x,
        event.renderedPosition.y
      );
      setTooltip({ node: nodeData, x: pos.x, y: pos.y });
    });

    cy.on('mouseout', 'node', () => {
      setTooltip(null);
    });

    cy.on('drag pan zoom', () => {
      setTooltip(null);
    });

    cyRef.current = cy;

    return () => {
      cyRef.current = null;
      setTooltip(null);
      cy.destroy();
    };
  }, [graph, onSelectNode]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.nodes().unselect();
    if (selectedNodeId) {
      cy.getElementById(selectedNodeId).select();
    }
  }, [selectedNodeId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.elements().removeClass('search-match search-dimmed');

    if (!searchQuery.trim()) {
      return;
    }

    if (matchedNodeId) {
      const targetNode = cy.getElementById(matchedNodeId);
      if (targetNode.length > 0) {
        cy.elements().addClass('search-dimmed');
        targetNode.removeClass('search-dimmed').addClass('search-match');
        targetNode.connectedEdges().removeClass('search-dimmed');
        targetNode.neighborhood('node').removeClass('search-dimmed');
        cy.stop();
        cy.animate(
          {
            center: { eles: targetNode },
            zoom: Math.max(cy.zoom(), 1.25),
          },
          { duration: 220 }
        );
      }
    } else {
      cy.elements().addClass('search-dimmed');
    }
  }, [matchedNodeId, searchQuery, graph]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || fitTrigger === 0) {
      return;
    }

    cy.stop();
    cy.animate(
      {
        fit: {
          eles: cy.elements(),
          padding: 44,
        },
      },
      { duration: 220 }
    );
  }, [fitTrigger]);

  if (!graph) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-6">
          <h2 className="text-base font-medium text-zinc-100">
            Analiza dependencias reales de código
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Soporta JS/TS, Java, Python, C/C++ y HTML/CSS. Ingresa un repositorio público de GitHub arriba o carga el repo demo.
          </p>
          <button
            type="button"
            onClick={onLoadDemo}
            className="mt-4 cursor-pointer rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/25"
          >
            Probar con Repo Demo
          </button>
        </div>
      </div>
    );
  }

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="relative h-full w-full bg-zinc-950">
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/90 px-2.5 py-1.5 shadow-lg backdrop-blur">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Buscar archivo en el grafo..."
            aria-label="Buscar archivo en el grafo"
            className="w-52 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none"
          />
          {hasQuery && (
            <>
              <span
                className={`text-[10px] font-medium ${
                  matchCount > 0 ? 'text-cyan-400' : 'text-amber-400'
                }`}
              >
                {matchCount > 0 ? `${matchCount} coinc.` : 'Sin resultados'}
              </span>
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Limpiar búsqueda"
                className="cursor-pointer rounded px-1 text-xs text-zinc-400 hover:text-zinc-100"
              >
                ✕
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onFitGraph}
          className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          Centrar grafo
        </button>
      </div>

      <div ref={containerRef} className="h-full w-full" />

      {tooltip && (
        <div
          role="tooltip"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          className="pointer-events-none absolute z-30 w-72 rounded-xl border border-zinc-700/80 bg-zinc-900/95 p-3 text-xs shadow-2xl backdrop-blur"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-mono text-xs font-semibold text-zinc-100">
                {tooltip.node.label}
              </div>
              <div className="truncate font-mono text-[10px] text-zinc-400">
                {tooltip.node.path}
              </div>
            </div>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                LANGUAGE_BADGE_COLORS[tooltip.node.languageGroup]
              }`}
            >
              {tooltip.node.languageLabel}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-medium text-indigo-300">
              {tooltip.node.fileSummary.role}
            </span>
            <span className="text-zinc-400">
              {tooltip.node.fileSummary.lineCount} líneas
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-zinc-300">
            {tooltip.node.fileSummary.summary}
          </p>

          {tooltip.node.fileSummary.highlights.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tooltip.node.fileSummary.highlights.map((item) => (
                <span
                  key={item}
                  className="rounded border border-zinc-700/70 bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/90 px-3 py-2 text-[11px] text-zinc-300 backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-yellow-400 bg-zinc-900" />
          JS/TS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-orange-400 bg-zinc-900" />
          Java
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-400 bg-zinc-900" />
          Python
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-purple-400 bg-zinc-900" />
          C/C++
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400 bg-zinc-900" />
          HTML/CSS
        </span>
        <span className="text-zinc-600">|</span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
          Crítico
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-zinc-400 bg-zinc-800" />
          Huérfano
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="h-0.5 w-3.5 bg-red-500" />
          Ciclo
        </span>
      </div>
    </div>
  );
}
