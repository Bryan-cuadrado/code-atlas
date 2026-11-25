import type {
  DependencyCycle,
  GraphAnalysisSummary,
  GraphEdgeData,
  GraphNodeData,
} from '../types/graph';

const CRITICAL_IN_DEGREE_THRESHOLD = 2;

type VisitState = 0 | 1 | 2;

/**
 * Finds Strongly Connected Components via Tarjan's algorithm so every edge belonging
 * to a circular dependency can be marked accurately.
 */
function findCyclicEdgeIds(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>
): { cyclicEdgeIds: Set<string>; cyclicNodeIds: Set<string> } {
  let currentIndex = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const componentByNode = new Map<string, number>();
  const componentMembers = new Map<number, string[]>();
  let componentId = 0;

  function strongConnect(nodeId: string): void {
    indices.set(nodeId, currentIndex);
    lowlink.set(nodeId, currentIndex);
    currentIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        const nodeLow = lowlink.get(nodeId) ?? 0;
        const neighborLow = lowlink.get(neighbor) ?? 0;
        lowlink.set(nodeId, Math.min(nodeLow, neighborLow));
      } else if (onStack.has(neighbor)) {
        const nodeLow = lowlink.get(nodeId) ?? 0;
        const neighborIndex = indices.get(neighbor) ?? 0;
        lowlink.set(nodeId, Math.min(nodeLow, neighborIndex));
      }
    }

    if (lowlink.get(nodeId) === indices.get(nodeId)) {
      const members: string[] = [];
      let member: string | undefined;
      do {
        member = stack.pop();
        if (member !== undefined) {
          onStack.delete(member);
          componentByNode.set(member, componentId);
          members.push(member);
        }
      } while (member !== undefined && member !== nodeId);

      componentMembers.set(componentId, members);
      componentId += 1;
    }
  }

  for (const nodeId of nodeIds) {
    if (!indices.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  const cyclicEdgeIds = new Set<string>();
  const cyclicNodeIds = new Set<string>();

  for (const source of nodeIds) {
    const sourceComp = componentByNode.get(source);
    const members = sourceComp !== undefined ? (componentMembers.get(sourceComp) ?? []) : [];
    const neighbors = adjacency.get(source) ?? [];

    for (const target of neighbors) {
      const targetComp = componentByNode.get(target);
      const isSelfLoop = source === target;
      const isSameMultiNodeScc = sourceComp !== undefined && sourceComp === targetComp && members.length > 1;

      if (isSelfLoop || isSameMultiNodeScc) {
        cyclicEdgeIds.add(`${source}->${target}`);
        cyclicNodeIds.add(source);
        cyclicNodeIds.add(target);
      }
    }
  }

  return { cyclicEdgeIds, cyclicNodeIds };
}

function canonicalizeCycleKey(cycleWithoutRepeat: readonly string[]): string {
  if (cycleWithoutRepeat.length === 0) {
    return '';
  }

  let minIndex = 0;
  for (let i = 1; i < cycleWithoutRepeat.length; i += 1) {
    if (cycleWithoutRepeat[i] < cycleWithoutRepeat[minIndex]) {
      minIndex = i;
    }
  }

  const rotated = [
    ...cycleWithoutRepeat.slice(minIndex),
    ...cycleWithoutRepeat.slice(0, minIndex),
  ];
  return rotated.join('->');
}

/**
 * Extracts distinct circular dependency paths using DFS.
 */
function detectCyclesWithDfs(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, readonly string[]>
): DependencyCycle[] {
  const visitState = new Map<string, VisitState>();
  const pathStack: string[] = [];
  const uniqueCycles = new Map<string, DependencyCycle>();

  function dfs(current: string): void {
    visitState.set(current, 1);
    pathStack.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const state = visitState.get(neighbor) ?? 0;

      if (state === 1) {
        const startIndex = pathStack.indexOf(neighbor);
        if (startIndex !== -1) {
          const cycleSegment = pathStack.slice(startIndex);
          const key = canonicalizeCycleKey(cycleSegment);
          if (!uniqueCycles.has(key)) {
            uniqueCycles.set(key, {
              id: `cycle:${uniqueCycles.size + 1}`,
              nodePaths: [...cycleSegment, neighbor],
            });
          }
        }
      } else if (state === 0) {
        dfs(neighbor);
      }
    }

    pathStack.pop();
    visitState.set(current, 2);
  }

  for (const nodeId of nodeIds) {
    if ((visitState.get(nodeId) ?? 0) === 0) {
      dfs(nodeId);
    }
  }

  return Array.from(uniqueCycles.values());
}

/**
 * Computes in-degree, out-degree, critical files, orphan files, and circular dependencies.
 */
export function analyzeDependencyGraph(
  baseNodes: readonly Omit<GraphNodeData, 'inDegree' | 'outDegree' | 'isCritical' | 'isOrphan' | 'inCycle'>[],
  rawEdges: readonly { source: string; target: string }[]
): {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  analysis: GraphAnalysisSummary;
} {
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of baseNodes) {
    inDegreeMap.set(node.id, 0);
    outDegreeMap.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  const seenEdges = new Set<string>();
  const deduplicatedEdges: { source: string; target: string }[] = [];

  for (const edge of rawEdges) {
    const key = `${edge.source}->${edge.target}`;
    if (seenEdges.has(key)) {
      continue;
    }
    seenEdges.add(key);
    deduplicatedEdges.push(edge);

    outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) ?? 0) + 1);
    inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) ?? 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const nodeIds = baseNodes.map((node) => node.id);
  const { cyclicEdgeIds, cyclicNodeIds } = findCyclicEdgeIds(nodeIds, adjacency);
  const cycles = detectCyclesWithDfs(nodeIds, adjacency);

  const analyzedNodes: GraphNodeData[] = baseNodes.map((node) => {
    const inDegree = inDegreeMap.get(node.id) ?? 0;
    const outDegree = outDegreeMap.get(node.id) ?? 0;
    return {
      ...node,
      inDegree,
      outDegree,
      isCritical: inDegree >= CRITICAL_IN_DEGREE_THRESHOLD,
      isOrphan: inDegree === 0 && outDegree === 0,
      inCycle: cyclicNodeIds.has(node.id),
    };
  });

  const analyzedEdges: GraphEdgeData[] = deduplicatedEdges.map((edge) => {
    const edgeKey = `${edge.source}->${edge.target}`;
    return {
      id: `imports:${edgeKey}`,
      source: edge.source,
      target: edge.target,
      isCycle: cyclicEdgeIds.has(edgeKey),
    };
  });

  const criticalFiles = analyzedNodes
    .filter((node) => node.isCritical)
    .sort((a, b) => b.inDegree - a.inDegree || a.path.localeCompare(b.path));

  const orphanFiles = analyzedNodes
    .filter((node) => node.isOrphan)
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    nodes: analyzedNodes,
    edges: analyzedEdges,
    analysis: {
      totalFiles: analyzedNodes.length,
      totalEdges: analyzedEdges.length,
      cycleCount: cycles.length,
      orphanCount: orphanFiles.length,
      criticalFiles,
      orphanFiles,
      cycles,
    },
  };
}
