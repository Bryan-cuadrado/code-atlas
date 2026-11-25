import type {
  AnalysisExportReport,
  CodeGraph,
  ExportFormat,
  ExportLanguageCount,
} from '../types/graph';

function computeDetectedLanguages(graph: CodeGraph): ExportLanguageCount[] {
  const counts = new Map<string, number>();

  for (const node of graph.nodes) {
    counts.set(node.languageLabel, (counts.get(node.languageLabel) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([language, fileCount]) => ({ language, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount || a.language.localeCompare(b.language));
}

export function buildExportReportData(
  graph: CodeGraph,
  exportedAtIso: string
): AnalysisExportReport {
  return {
    repository: {
      fullName: graph.repo.fullName,
      defaultBranch: graph.repo.defaultBranch,
      isDemo: graph.repo.isDemo,
    },
    exportedAt: exportedAtIso,
    metrics: {
      totalFiles: graph.analysis.totalFiles,
      totalEdges: graph.analysis.totalEdges,
      cycleCount: graph.analysis.cycleCount,
      orphanCount: graph.analysis.orphanCount,
    },
    detectedLanguages: computeDetectedLanguages(graph),
    cycles: graph.analysis.cycles.map((cycle) => [...cycle.nodePaths]),
    criticalFiles: graph.analysis.criticalFiles.map((file) => ({
      path: file.path,
      inDegree: file.inDegree,
      outDegree: file.outDegree,
      inCycle: file.inCycle,
    })),
    orphanFiles: graph.analysis.orphanFiles.map((file) => file.path),
  };
}

export function formatAnalysisAsJson(graph: CodeGraph, exportedAtIso: string): string {
  const report = buildExportReportData(graph, exportedAtIso);
  return JSON.stringify(report, null, 2);
}

export function formatAnalysisAsMarkdown(graph: CodeGraph, exportedAtIso: string): string {
  const report = buildExportReportData(graph, exportedAtIso);
  const lines: string[] = [
    `# Reporte de Análisis — ${report.repository.fullName}`,
    '',
    `- **Rama:** \`${report.repository.defaultBranch}\``,
    `- **Origen:** ${report.repository.isDemo ? 'Repositorio Demo local' : 'GitHub REST API'}`,
    `- **Exportado:** ${report.exportedAt}`,
    '',
    '## Métricas Generales',
    '',
    '| Métrica | Valor |',
    '| --- | ---: |',
    `| Archivos analizados | ${report.metrics.totalFiles} |`,
    `| Dependencias (imports) | ${report.metrics.totalEdges} |`,
    `| Ciclos detectados | ${report.metrics.cycleCount} |`,
    `| Archivos huérfanos | ${report.metrics.orphanCount} |`,
    '',
    `## Lenguajes Detectados (${report.detectedLanguages.length})`,
    '',
  ];

  if (report.detectedLanguages.length === 0) {
    lines.push('No se detectaron archivos compatibles.');
  } else {
    lines.push('| Lenguaje | Archivos |');
    lines.push('| --- | ---: |');
    for (const item of report.detectedLanguages) {
      lines.push(`| ${item.language} | ${item.fileCount} |`);
    }
  }

  lines.push('', `## Dependencias Circulares (${report.cycles.length})`, '');

  if (report.cycles.length === 0) {
    lines.push('No se detectaron dependencias circulares.');
  } else {
    report.cycles.forEach((cyclePaths, index) => {
      lines.push(`${index + 1}. \`${cyclePaths.join(' -> ')}\``);
    });
  }

  lines.push('', `## Archivos Críticos (${report.criticalFiles.length})`, '');

  if (report.criticalFiles.length === 0) {
    lines.push('No se detectaron archivos con 2 o más importaciones entrantes.');
  } else {
    lines.push('| Archivo | In-degree | Out-degree | En ciclo |');
    lines.push('| --- | ---: | ---: | :---: |');
    for (const file of report.criticalFiles) {
      lines.push(
        `| \`${file.path}\` | ${file.inDegree} | ${file.outDegree} | ${file.inCycle ? 'Sí' : 'No'} |`
      );
    }
  }

  lines.push('', `## Archivos Huérfanos (${report.orphanFiles.length})`, '');

  if (report.orphanFiles.length === 0) {
    lines.push('No se detectaron archivos huérfanos.');
  } else {
    for (const orphanPath of report.orphanFiles) {
      lines.push(`- \`${orphanPath}\``);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function buildExportFileName(repoFullName: string, format: ExportFormat): string {
  const safeSlug = repoFullName.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  const extension = format === 'json' ? 'json' : 'md';
  return `codeatlas-${safeSlug || 'analisis'}.${extension}`;
}
