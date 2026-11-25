# CodeAtlas

**CodeAtlas** es una aplicación web interactiva para visualizar y auditar la arquitectura de dependencias internas en repositorios multilenguaje (`.js`, `.jsx`, `.ts`, `.tsx`, `.java`, `.py`, `.c`, `.cpp`, `.h`, `.hpp`, `.html`, `.css`). Permite detectar de un vistazo módulos críticos, dependencias circulares y archivos huérfanos sin salir del navegador.

---

## Características principales

- **Mapa interactivo de dependencias con Cytoscape.js:**
  - El tamaño de cada nodo escala proporcionalmente según su *in-degree* (cantidad de archivos que lo importan).
  - Los **archivos críticos** (`in-degree >= 2`) se destacan en índigo para identificar puntos sensibles al cambio.
  - Las **dependencias circulares** se resaltan con aristas rojas dirigidas y fondo carmesí en los módulos involucrados.
  - Cada nodo diferencia su lenguaje mediante el color de borde (**JS/TS**, **Java**, **Python**, **C/C++**, **HTML/CSS**) e incluye un tooltip flotante al pasar el cursor.
  - Los **archivos huérfanos** (`in-degree === 0` y `out-degree === 0`) aparecen con borde discontinuo para facilitar la limpieza de código muerto.
- **Buscador rápido y control de cámara:**
  - Busca cualquier archivo dentro del grafo cargado; selecciona automáticamente la mejor coincidencia y centra la cámara sobre ella.
  - Botón **Centrar grafo** (*Fit*) para reencuadrar toda la red de dependencias en un clic.
- **Exportación de reportes:**
  - Botón **Exportar Reporte (.md)** para descargar un resumen en Markdown con métricas, lenguajes detectados, ciclos, archivos críticos y huérfanos (además de exportación en **JSON**).
- **Modo Demo sin consumo de cuota:**
  - Incluye el botón **Probar con Repo Demo** con un proyecto local realista que contiene imports ES/CommonJS, archivos críticos, un ciclo de 3 nodos y un archivo huérfano.
- **Resiliencia ante la API de GitHub:**
  - Soporte opcional para **GitHub Personal Access Token** desde la interfaz para ampliar la cuota de solicitudes.
  - Manejo explícito de errores `HTTP 403` (Rate Limit con hora de restablecimiento) y `HTTP 401` (token inválido).

---

## Cómo funciona la arquitectura

El proyecto sigue una separación estricta de responsabilidades definida en [`AGENTS.md`](./AGENTS.md) con TypeScript en modo estricto (sin `any`):

```text
src/
├── types/graph.ts               # Modelos de datos estrictos compartidos
├── core/                        # Lógica pura (CERO React, DOM ni fetch)
│   ├── parsers/                 # Parsers modulares por lenguaje
│   │   ├── pathUtils.ts         # Normalización POSIX y limpieza de comentarios
│   │   ├── jsParser.ts          # import, export from y require relativos
│   │   ├── javaParser.ts        # Indexado package + clase e imports internos
│   │   ├── pythonParser.ts      # import y from ... import hacia .py locales
│   │   ├── cppParser.ts         # #include "..." locales
│   │   └── htmlParser.ts        # <script src="..."> y <link href="..."> locales
│   ├── dependencyParser.ts      # Coordinador de parsers por extensión
│   ├── fileSummarizer.ts        # Resumidor estático y detector de rol técnico
│   ├── graphAnalyzer.ts         # Cálculo de métricas, Tarjan SCC y DFS de ciclos
│   ├── graphBuilder.ts          # Construcción del grafo y búsqueda de nodos
│   └── reportExporter.ts        # Serialización pura a JSON y Markdown
├── services/githubApi.ts        # Comunicación exclusiva con GitHub REST API
├── data/demoRepo.ts             # Dataset local para "Probar con Repo Demo"
└── components/                  # UI pura (HeaderBar, GraphCanvas, SidePanel)
```

### 1. Parsers modulares multilenguaje y resumidor estático (`src/core/parsers/`, `src/core/fileSummarizer.ts`)
- Antes de extraer dependencias, los comentarios se eliminan preservando literales de cadena para evitar falsos positivos.
- Cada lenguaje usa su parser dedicado: JS/TS (`import`, `export ... from`, `require`), Java (índice `package + clase` ignorando `java.*` y `javax.*`), Python (`import` y `from ... import`), C/C++ (`#include "..."` locales ignorando `<...>`) y HTML (`<script src>` / `<link href>`).
- `fileSummarizer.ts` extrae el comentario descriptivo de cabecera, detecta el rol técnico del archivo (Servlet/DAO/Entidad en Java, React/API/DOM en JS/TS, `<title>` y conteo de `<form>`/`<script>` en HTML, clases/funciones en Python y C/C++) y lo muestra en un tooltip al pasar el cursor sobre cualquier nodo.

### 2. Detección de ciclos con DFS y Tarjan SCC (`src/core/graphAnalyzer.ts`)
- **Tarjan's Strongly Connected Components (`findCyclicEdgeIds`):** Agrupa los nodos en componentes fuertemente conexas. Cualquier arista `u -> v` cuyos extremos pertenezcan a la misma componente de tamaño > 1 (o sea un auto-ciclo) forma parte de una dependencia circular y se marca con `isCycle: true` para resaltarse en rojo.
- **Búsqueda en profundidad DFS (`detectCyclesWithDfs`):** Recorre el grafo con marcado de 3 estados (`0` no visitado, `1` en visita, `2` completado) para extraer y deduplicar las rutas circulares legibles (por ejemplo, `authService.ts → sessionStore.ts → tokenRefresh.ts → authService.ts`).
- **Métricas por nodo:** Calcula `inDegree`, `outDegree`, `isCritical` (`inDegree >= 2`) e `isOrphan` (`inDegree === 0 && outDegree === 0`).

### 3. Integración con GitHub REST API (`src/services/githubApi.ts`)
- Obtiene los metadatos y el árbol recursivo del repositorio (`/repos/:owner/:repo` y `/git/trees/:branch?recursive=1`).
- Excluye directorios `node_modules`, `dist`, `build`, `target`, `.mvn`, `__pycache__` y `.git`, descarta archivos de declaración `.d.ts` y limita el análisis a los primeros **100 archivos** de código para proteger la cuota de API.
- Descarga el contenido de cada archivo mediante `/git/blobs/:sha` con concurrencia acotada y cabecera opcional `Authorization: Bearer <token>`.

---

## Ejecución local

### Requisitos
- **Node.js LTS** (incluye `npm`)

### Instalación y desarrollo

```bash
npm install
npm run dev
```

*(En Windows PowerShell, si la política de ejecución restringe scripts `.ps1`, utiliza `npm.cmd install` y `npm.cmd run dev`.)*

Luego abre `http://localhost:5173/` en tu navegador.

### Build de producción y despliegue en GitHub Pages

El archivo [`vite.config.ts`](./vite.config.ts) está configurado con `base: './'` y [`package.json`](./package.json) incluye `gh-pages` con los scripts `predeploy` y `deploy`:

```bash
npm run build
npm run preview
```

Para publicar la carpeta `dist/` en la rama `gh-pages` de tu repositorio en GitHub:

```bash
npm run deploy
```
