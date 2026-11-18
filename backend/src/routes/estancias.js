/**
 * estancias.js
 * Router Express para las operaciones de entrada, salida y cobro de estancias.
 */

import { Router } from 'express';
import {
  registrarEntrada,
  consultarSalida,
  registrarPago,
} from '../data/almacenamiento.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/estancias/entrada
// Registra la entrada de un vehículo al estacionamiento.
// Body: { placa, tipoVehiculo, cajonId }
// ---------------------------------------------------------------------------
router.post('/entrada', async (req, res) => {
  const { placa, tipoVehiculo, cajonId, fechaEntradaOverride } = req.body;

  // Validación de campos requeridos
  if (!placa || !tipoVehiculo || !cajonId) {
    return res.status(400).json({
      ok:      false,
      mensaje: 'Campos requeridos: placa, tipoVehiculo, cajonId',
    });
  }

  try {
    const estancia = await registrarEntrada({ placa, tipoVehiculo, cajonId, fechaEntradaOverride });
    return res.status(201).json({ ok: true, data: estancia });
  } catch (err) {
    return res.status(err.codigoHttp ?? 500).json({
      ok:      false,
      mensaje: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/estancias/salida/:placa
// Cotiza el cobro de salida sin finalizar la estancia.
// ---------------------------------------------------------------------------
router.get('/salida/:placa', async (req, res) => {
  try {
    const resultado = await consultarSalida(req.params.placa);
    return res.json({ ok: true, data: resultado });
  } catch (err) {
    return res.status(err.codigoHttp ?? 500).json({
      ok:      false,
      mensaje: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/estancias/pago
// Registra el pago, cierra la estancia y libera el cajón.
// Body: { estanciaId, metodoPago, requiereFactura, datosFiscales? }
// ---------------------------------------------------------------------------
router.post('/pago', async (req, res) => {
  const { estanciaId, metodoPago, requiereFactura, datosFiscales } = req.body;

  if (!estanciaId) {
    return res.status(400).json({
      ok:      false,
      mensaje: 'El campo estanciaId es requerido',
    });
  }

  try {
    const pago = await registrarPago({ estanciaId, metodoPago, requiereFactura, datosFiscales });
    return res.status(201).json({ ok: true, data: pago });
  } catch (err) {
    return res.status(err.codigoHttp ?? 500).json({
      ok:      false,
      mensaje: err.message,
    });
  }
});

export default router;
