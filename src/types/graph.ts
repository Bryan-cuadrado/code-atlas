export type CodeFileExtension =
  | 'js'
  | 'jsx'
  | 'ts'
  | 'tsx'
  | 'java'
  | 'py'
  | 'c'
  | 'cpp'
  | 'h'
  | 'hpp'
  | 'html'
  | 'css';

export type LanguageGroup = 'jsts' | 'java' | 'python' | 'cpp' | 'web';

export interface FileSummary {
  summary: string;
  role: string;
  highlights: string[];
  lineCount: number;
}

export interface ParsedRepoRef {
  owner: string;
  name: string;
}

export interface RepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  description: string;
  isDemo: boolean;
  totalCodeFilesInRepo?: number;
  analyzedFilesLimitReached?: boolean;
  maxCodeFilesLimit?: number;
  fromCache?: boolean;
  cachedAtIso?: string;
}

export interface SourceFileEntry {
  path: string;
  content: string;
  sizeBytes?: number;
}

export interface GraphNodeData {
  id: string;
  label: string;
  path: string;
  extension: CodeFileExtension;
  languageGroup: LanguageGroup;
  languageLabel: string;
  fileSummary: FileSummary;
  sizeBytes?: number;
  inDegree: number;
  outDegree: number;
  isCritical: boolean;
  isOrphan: boolean;
  inCycle: boolean;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  isCycle: boolean;
}

export interface DependencyCycle {
  id: string;
  nodePaths: string[];
}

export interface GraphAnalysisSummary {
  totalFiles: number;
  totalEdges: number;
  cycleCount: number;
  orphanCount: number;
  criticalFiles: GraphNodeData[];
  orphanFiles: GraphNodeData[];
  cycles: DependencyCycle[];
}

export interface CodeGraph {
  repo: RepoMetadata;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  analysis: GraphAnalysisSummary;
}

export type AppErrorKind =
  | 'rate_limit'
  | 'unauthorized'
  | 'not_found'
  | 'invalid_input'
  | 'network'
  | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  message: string;
  resetAtIso?: string;
}

export type ExportFormat = 'json' | 'markdown';

export interface ExportCriticalFileItem {
  path: string;
  inDegree: number;
  outDegree: number;
  inCycle: boolean;
}

export interface ExportLanguageCount {
  language: string;
  fileCount: number;
}

export interface AnalysisExportReport {
  repository: {
    fullName: string;
    defaultBranch: string;
    isDemo: boolean;
  };
  exportedAt: string;
  metrics: {
    totalFiles: number;
    totalEdges: number;
    cycleCount: number;
    orphanCount: number;
  };
  detectedLanguages: ExportLanguageCount[];
  cycles: string[][];
  criticalFiles: ExportCriticalFileItem[];
  orphanFiles: string[];
}

export interface CachedCodeGraphEntry {
  savedAt: number;
  graph: CodeGraph;
}
