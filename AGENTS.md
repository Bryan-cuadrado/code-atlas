# AGENTS.md - Reglas de Arquitectura para CodeAtlas

## Stack
- React + Vite + TypeScript (strict mode)
- Tailwind CSS para estilos (tema oscuro minimalista)
- Cytoscape.js para visualización del grafo interactivo

## Reglas Estrictas de Arquitectura
1. **Separación de responsabilidades:**
   - Todo el código en `src/core/` debe ser TypeScript puro (CERO imports de React, DOM o fetch).
   - Toda comunicación con la API de GitHub vive exclusivamente en `src/services/githubApi.ts`.
   - Los componentes en `src/components/` solo renderizan UI y disparan callbacks.
2. **Tipado estricto:** Prohibido usar `any`. Todos los modelos de datos deben vivir en `src/types/graph.ts`.
3. **Resiliencia:**
   - Manejar errores de Rate Limit (HTTP 403) de GitHub con mensajes claros al usuario.
   - Incluir siempre un botón "Probar con Repo Demo" que cargue datos locales de ejemplo para pruebas inmediatas sin gastar cuota de API.
4. **Flujo de trabajo:**
   - Implementar una fase a la vez.
   - Verificar que `npm run build` pase sin errores de TypeScript al terminar cada fase.
