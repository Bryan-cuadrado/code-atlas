import type { FormEvent } from 'react';

interface HeaderBarProps {
  repoInput: string;
  githubToken: string;
  isLoading: boolean;
  onRepoInputChange: (value: string) => void;
  onGithubTokenChange: (value: string) => void;
  onAnalyzeSubmit: () => void;
  onLoadDemo: () => void;
}

export function HeaderBar({
  repoInput,
  githubToken,
  isLoading,
  onRepoInputChange,
  onGithubTokenChange,
  onAnalyzeSubmit,
  onLoadDemo,
}: HeaderBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAnalyzeSubmit();
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 bg-zinc-950/90 px-5 py-3.5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-sm font-semibold text-indigo-400">
          CA
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">CodeAtlas</h1>
          <p className="text-xs text-zinc-400">Análisis multilenguaje de dependencias</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
        <input
          type="text"
          value={repoInput}
          onChange={(event) => onRepoInputChange(event.target.value)}
          placeholder="propietario/repositorio o URL de GitHub"
          aria-label="Repositorio de GitHub"
          disabled={isLoading}
          className="w-full min-w-56 max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/40 disabled:opacity-50"
        />
        <input
          type="password"
          value={githubToken}
          onChange={(event) => onGithubTokenChange(event.target.value)}
          placeholder="Token GitHub (opcional)"
          aria-label="GitHub Personal Access Token opcional"
          autoComplete="off"
          disabled={isLoading}
          className="w-48 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="cursor-pointer rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Analizando...' : 'Analizar'}
        </button>
        <button
          type="button"
          onClick={onLoadDemo}
          disabled={isLoading}
          className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Probar con Repo Demo
        </button>
      </form>
    </header>
  );
}
