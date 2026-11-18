/**
 * infraestructura.js
 * Router Express para la gestión de pisos y cajones (RF-11 / RN-10).
 */

import { Router } from 'express';
import {
  obtenerEstadoMatriz,
  crearCajon,
} from '../data/almacenamiento.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/infraestructura/cajones
// Retorna todos los cajones agrupados por piso con sus estados actuales.
// ---------------------------------------------------------------------------
router.get('/cajones', async (_req, res) => {
  try {
    const { pisos, cajones } = await obtenerEstadoMatriz();

    // Agrupar cajones por pisoId para facilitar el render del tablero visual
    const matrizPorPiso = pisos.map((piso) => ({
      ...piso,
      cajones: cajones.filter((c) => c.pisoId === piso.id),
      resumen: {
        total:        cajones.filter((c) => c.pisoId === piso.id).length,
        disponibles:  cajones.filter((c) => c.pisoId === piso.id && c.estado === 'DISPONIBLE').length,
        ocupados:     cajones.filter((c) => c.pisoId === piso.id && c.estado === 'OCUPADO').length,
        mantenimiento: cajones.filter((c) => c.pisoId === piso.id && c.estado === 'MANTENIMIENTO').length,
      },
    }));

    return res.json({ ok: true, data: matrizPorPiso });
  } catch (err) {
    return res.status(err.codigoHttp ?? 500).json({
      ok:      false,
      mensaje: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/infraestructura/cajones
// Crea un nuevo cajón dinámicamente (Rol: Administrador).
// Body: { pisoId, codigo, categoria }
// ---------------------------------------------------------------------------
router.post('/cajones', async (req, res) => {
  const { pisoId, codigo, categoria } = req.body;

  if (!pisoId || !codigo || !categoria) {
    return res.status(400).json({
      ok:      false,
      mensaje: 'Campos requeridos: pisoId, codigo, categoria',
    });
  }

  try {
    const nuevoCajon = await crearCajon({ pisoId, codigo, categoria });
    return res.status(201).json({ ok: true, data: nuevoCajon });
  } catch (err) {
    return res.status(err.codigoHttp ?? 500).json({
      ok:      false,
      mensaje: err.message,
    });
  }
});

export default router;
