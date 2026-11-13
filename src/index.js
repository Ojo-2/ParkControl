/**
 * index.js
 * Punto de entrada del servidor HTTP ParkControl.
 * Levanta Express con middlewares globales y registra todos los routers.
 */

import express from 'express';
import cors    from 'cors';

import routerEstancias      from './routes/estancias.js';
import routerInfraestructura from './routes/infraestructura.js';

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ---------------------------------------------------------------------------
// Middlewares globales
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
app.use('/api/estancias',       routerEstancias);
app.use('/api/infraestructura', routerInfraestructura);

// Health-check básico
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, servicio: 'ParkControl API', version: '2.0.0' });
});

// Handler 404 genérico
app.use((_req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

// Handler de errores no capturados
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR no manejado]', err);
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

// ---------------------------------------------------------------------------
// Iniciar servidor
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n  🅿️  Servidor ParkControl corriendo en http://localhost:${PORT}`);
  console.log(`  📋 Health check: http://localhost:${PORT}/api/health\n`);
});

export default app;
