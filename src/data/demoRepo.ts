import type { RepoMetadata, SourceFileEntry } from '../types/graph';

export const DEMO_REPO_METADATA: RepoMetadata = {
  owner: 'code-atlas',
  name: 'demo-workspace',
  fullName: 'code-atlas/demo-workspace',
  defaultBranch: 'main',
  description:
    'Repositorio de demostración multilenguaje con imports reales, archivos críticos, dependencias circulares y un archivo huérfano.',
  isDemo: true,
};

export const DEMO_SOURCE_FILES: SourceFileEntry[] = [
  {
    path: 'index.html',
    sizeBytes: 420,
    content: `<!-- Página principal de entrada del portal demo -->
<!doctype html>
<html lang="es">
  <head>
    <title>Portal de Pedidos Demo</title>
    <link rel="stylesheet" href="./src/styles/app.css" />
  </head>
  <body>
    <form id="login-form"></form>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/styles/app.css',
    sizeBytes: 280,
    content: `/* Estilos globales del tema oscuro para el portal demo */
.app-shell {
  background-color: #09090b;
  color: #f4f4f5;
}
`,
  },
  {
    path: 'src/types/models.ts',
    sizeBytes: 640,
    content: `/**
 * Modelos centrales de dominio compartidos entre servicios y vistas.
 */
export interface User {
  id: string;
  email: string;
}

export interface Order {
  id: string;
  total: number;
}
`,
  },
  {
    path: 'src/utils/logger.ts',
    sizeBytes: 420,
    content: `// Utilidad centralizada para registrar eventos de diagnóstico.
export function logInfo(message: string): void {
  console.info('[CodeAtlas Demo]', message);
}
`,
  },
  {
    path: 'src/utils/formatCurrency.js',
    sizeBytes: 310,
    content: `// Formatea montos monetarios en formato USD legible.
function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

module.exports = { formatCurrency };
`,
  },
  {
    path: 'src/services/apiClient.ts',
    sizeBytes: 580,
    content: `/**
 * Cliente HTTP ligero basado en fetch para endpoints REST.
 */
import { logInfo } from '../utils/logger';

export async function getJson<T>(endpoint: string): Promise<T> {
  logInfo('GET ' + endpoint);
  const res = await fetch(endpoint);
  return (await res.json()) as T;
}
`,
  },
  {
    path: 'src/services/authService.ts',
    sizeBytes: 790,
    content: `/**
 * Gestiona la sesión del usuario autenticado y su verificación.
 */
import type { User } from '../types/models';
import { logInfo } from '../utils/logger';
import { getActiveSession } from './sessionStore';

export function getCurrentUser(): User | null {
  const session = getActiveSession();
  logInfo('Checking session');
  return session ? { id: session.userId, email: 'demo@codeatlas.dev' } : null;
}
`,
  },
  {
    path: 'src/services/sessionStore.ts',
    sizeBytes: 690,
    content: `// Almacén en memoria para tokens y sesión activa.
import type { User } from '../types/models';
import { ensureValidToken } from './tokenRefresh';

export function getActiveSession(): { userId: string } | null {
  ensureValidToken();
  return { userId: 'u-1' };
}

export function cacheUser(_user: User): void {}
`,
  },
  {
    path: 'src/services/tokenRefresh.ts',
    sizeBytes: 510,
    content: `// Renovación automática de credenciales de acceso.
import { getCurrentUser } from './authService';

export function ensureValidToken(): boolean {
  return getCurrentUser() !== null;
}
`,
  },
  {
    path: 'src/services/orderService.ts',
    sizeBytes: 830,
    content: `/**
 * Servicio de consulta y seguimiento de órdenes del cliente.
 */
import type { Order } from '../types/models';
import { logInfo } from '../utils/logger';
import { getJson } from './apiClient';
import { getCurrentUser } from './authService';

export async function fetchOrders(): Promise<Order[]> {
  const user = getCurrentUser();
  logInfo(user ? user.id : 'guest');
  return getJson<Order[]>('/orders');
}
`,
  },
  {
    path: 'src/components/OrderCard.tsx',
    sizeBytes: 710,
    content: `import type { Order } from '../types/models';
const { formatCurrency } = require('../utils/formatCurrency');

export function OrderCard(order: Order): string {
  return order.id + ': ' + formatCurrency(order.total);
}
`,
  },
  {
    path: 'src/components/Dashboard.tsx',
    sizeBytes: 890,
    content: `/**
 * Vista principal que renderiza las tarjetas de órdenes del usuario.
 */
import type { Order, User } from '../types/models';
import { fetchOrders } from '../services/orderService';
import { OrderCard } from './OrderCard';

export async function renderDashboard(user: User): Promise<string[]> {
  const orders: Order[] = await fetchOrders();
  return orders.map((order) => user.email + ' -> ' + OrderCard(order));
}
`,
  },
  {
    path: 'src/App.tsx',
    sizeBytes: 560,
    content: `import { getCurrentUser } from './services/authService';
import { renderDashboard } from './components/Dashboard';

export function bootstrapApp(): void {
  const user = getCurrentUser();
  if (user) {
    void renderDashboard(user);
  }
}
`,
  },
  {
    path: 'src/main.tsx',
    sizeBytes: 290,
    content: `import { bootstrapApp } from './App';

bootstrapApp();
`,
  },
  {
    path: 'src/legacy/unusedHelper.ts',
    sizeBytes: 340,
    content: `// Utilidad heredada sin referencias activas en el proyecto.
export function legacyChecksum(input: string): number {
  return input.length * 42;
}
`,
  },
];
