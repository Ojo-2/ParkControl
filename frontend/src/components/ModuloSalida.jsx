import { useState, useEffect } from 'react';
import { Search, CreditCard, Banknote, Receipt, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { consultarSalida, procesarPago } from '../services/api.js';

/** Formatea minutos en "Xh Ym" */
function formatearTiempo(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Tarjeta de un renglón del desglose */
function RenglonDesglose({ label, valor, grande, enfasis }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${grande ? 'border-t border-slate-200 mt-1 pt-2.5' : ''}`}>
      <span className={`text-sm ${grande ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={`font-mono ${grande ? 'text-lg font-bold text-indigo-700' : enfasis ? 'text-sm font-semibold text-slate-700' : 'text-sm text-slate-600'}`}>
        {valor}
      </span>
    </div>
  );
}

export default function ModuloSalida({ onPagoRegistrado }) {
  const [placa,           setPlaca]           = useState('');
  const [cotizacion,      setCotizacion]       = useState(null); // { estancia, cotizacion }
  const [metodoPago,      setMetodoPago]       = useState('EFECTIVO');
  const [requiereFactura, setRequiereFactura]  = useState(false);
  const [cargandoBuscar,  setCargandoBuscar]   = useState(false);
  const [cargandoPago,    setCargandoPago]     = useState(false);
  const [comprobante,     setComprobante]      = useState(null);
  const [error,           setError]            = useState('');

  // Limpiar comprobante tras 12 segundos
  useEffect(() => {
    if (comprobante) {
      const t = setTimeout(() => {
        setComprobante(null);
        setCotizacion(null);
        setPlaca('');
      }, 12000);
      return () => clearTimeout(t);
    }
  }, [comprobante]);

  async function handleBuscar(e) {
    e.preventDefault();
    setError('');
    setCotizacion(null);
    setComprobante(null);

    if (!placa.trim()) return setError('Ingresa la placa a buscar');

    setCargandoBuscar(true);
    try {
      const data = await consultarSalida(placa);
      setCotizacion(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoBuscar(false);
    }
  }

  async function handlePago() {
    if (!cotizacion) return;
    setError('');
    setCargandoPago(true);
    try {
      const pago = await procesarPago({
        estanciaId:     cotizacion.estancia.id,
        metodoPago,
        requiereFactura,
      });
      setComprobante(pago);
      onPagoRegistrado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoPago(false);
    }
  }

  // ── Pantalla de comprobante ─────────────────────────────────────────────
  if (comprobante) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 space-y-4">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold">
          <CheckCircle2 size={18} />
          Pago confirmado — Cajón liberado
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <span className="font-medium text-slate-600">Placa</span>
          <span className="font-mono font-bold text-slate-800">{comprobante.placa}</span>

          <span className="font-medium text-slate-600">Cajón</span>
          <span>{comprobante.codigoCajon}</span>

          <span className="font-medium text-slate-600">Tiempo total</span>
          <span>{formatearTiempo(comprobante.tiempoTotalMinutos)}</span>

          <span className="font-medium text-slate-600">Subtotal</span>
          <span className="font-mono">${comprobante.cobro.subtotal.toFixed(2)}</span>

          <span className="font-medium text-slate-600">IVA 16%</span>
          <span className="font-mono">${comprobante.cobro.iva.toFixed(2)}</span>

          <span className="font-semibold text-slate-800">Total cobrado</span>
          <span className="font-mono font-bold text-indigo-700 text-base">
            ${comprobante.cobro.montoTotal.toFixed(2)} MXN
          </span>

          <span className="font-medium text-slate-600">Método de pago</span>
          <span>{comprobante.detallesPago.metodoPago}</span>

          <span className="font-medium text-slate-600">Token autofactura</span>
          <span className="font-mono text-xs text-slate-500 break-all">
            {comprobante.facturacion.tokenAutofacturacion}
          </span>

          <span className="font-medium text-slate-600">Estado fiscal</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit
            ${comprobante.facturacion.estadoFacturacion === 'FACTURADO_INDIVIDUAL'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'}`}>
            {comprobante.facturacion.estadoFacturacion.replace('_', ' ')}
          </span>
        </div>

        <button
          onClick={() => { setComprobante(null); setCotizacion(null); setPlaca(''); }}
          className="w-full py-2 rounded-lg border border-emerald-400 text-emerald-700
                     text-sm font-medium hover:bg-emerald-100 transition-colors"
        >
          Nueva consulta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Búsqueda por placa */}
      <form onSubmit={handleBuscar} className="flex gap-2">
        <input
          type="text"
          value={placa}
          maxLength={10}
          placeholder="Placa del vehículo"
          onChange={(e) => { setPlaca(e.target.value.toUpperCase()); setError(''); setCotizacion(null); }}
          className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-slate-800
                     font-mono uppercase tracking-widest text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                     placeholder:normal-case placeholder:tracking-normal placeholder:font-sans
                     placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={cargandoBuscar}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-700
                     text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50
                     transition-colors"
        >
          <Search size={15} />
          {cargandoBuscar ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Cotización */}
      {cotizacion && (
        <div className="space-y-4">
          {/* Datos de la estancia */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-2">
              <Clock size={15} />
              Estancia activa — {cotizacion.estancia.placa}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="font-medium">Vehículo</span>
              <span>{cotizacion.estancia.tipoVehiculo}</span>
              <span className="font-medium">Cajón</span>
              <span>{cotizacion.estancia.codigoCajon}</span>
              <span className="font-medium">Entrada</span>
              <span>{new Date(cotizacion.estancia.fechaEntrada).toLocaleString('es-MX')}</span>
              <span className="font-medium">Tiempo transcurrido</span>
              <span className="font-semibold text-slate-800">
                {formatearTiempo(cotizacion.cotizacion.minutosTotales)}
              </span>
            </div>
          </div>

          {/* Desglose tarifario */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-0.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Desglose del cobro
            </p>
            {cotizacion.cotizacion.horasDiurnas > 0 && (
              <RenglonDesglose
                label={`Primera hora (factor ${cotizacion.cotizacion.factorVehiculo}x)`}
                valor={`${cotizacion.cotizacion.horasDiurnas} hr`}
              />
            )}
            {cotizacion.cotizacion.fraccionesDiurnas > 0 && (
              <RenglonDesglose
                label={`Fracciones de 15 min (×${cotizacion.cotizacion.fraccionesDiurnas})`}
                valor={`+${cotizacion.cotizacion.fraccionesDiurnas * 8} MXN`}
              />
            )}
            {cotizacion.cotizacion.horasNocturnas > 0 && (
              <RenglonDesglose
                label="Tarifa nocturna fija"
                valor="$50.00"
              />
            )}
            <RenglonDesglose
              label="Subtotal (sin IVA)"
              valor={`$${cotizacion.cotizacion.subtotal.toFixed(2)}`}
              enfasis
            />
            <RenglonDesglose
              label="IVA 16%"
              valor={`$${cotizacion.cotizacion.iva.toFixed(2)}`}
            />
            <RenglonDesglose
              label="Total a cobrar"
              valor={`$${cotizacion.cotizacion.montoTotal.toFixed(2)} MXN`}
              grande
            />
          </div>

          {/* Método de pago */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                { value: 'TARJETA',  label: 'Tarjeta',  icon: CreditCard },
              ].map(({ value, label, icon: Icono }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMetodoPago(value)}
                  className={`
                    flex items-center justify-center gap-2 py-2.5 rounded-lg border-2
                    text-sm font-medium transition-all
                    ${metodoPago === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icono size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Factura */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requiereFactura}
              onChange={(e) => setRequiereFactura(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer
                         focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-700 flex items-center gap-1.5">
              <Receipt size={14} className="text-slate-400" />
              ¿Requiere factura individual (CFDI)?
            </span>
          </label>

          {/* Botón confirmar pago */}
          <button
            onClick={handlePago}
            disabled={cargandoPago}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg
                       bg-emerald-600 text-white text-sm font-semibold
                       hover:bg-emerald-700 active:bg-emerald-800
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors shadow-sm"
          >
            <CheckCircle2 size={16} />
            {cargandoPago ? 'Procesando…' : `Confirmar Pago y Liberar Cajón`}
          </button>
        </div>
      )}
    </div>
  );
}
