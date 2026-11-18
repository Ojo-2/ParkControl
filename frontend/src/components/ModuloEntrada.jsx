import { useState, useEffect } from 'react';
import { Car, Bike, Truck, ScanLine, LogIn, CheckCircle2, AlertCircle } from 'lucide-react';
import { registrarEntrada } from '../services/api.js';

const TIPOS_VEHICULO = [
  { value: 'AUTOMOVIL',   label: 'Automóvil',    icon: Car,   categoriaCompatible: 'AUTOMOVIL' },
  { value: 'SUV',         label: 'SUV / Camioneta', icon: Truck, categoriaCompatible: 'AUTOMOVIL' },
  { value: 'MOTOCICLETA', label: 'Motocicleta',  icon: Bike,  categoriaCompatible: 'MOTOCICLETA' },
];

/** Filtra cajones libres compatibles con el tipo de vehículo (RN-10). */
function cajonesCompatibles(pisos, tipoVehiculo) {
  if (!pisos || !tipoVehiculo) return [];
  const tipo = TIPOS_VEHICULO.find((t) => t.value === tipoVehiculo);
  if (!tipo) return [];

  return pisos.flatMap((piso) =>
    piso.cajones
      .filter((c) => c.estado === 'DISPONIBLE' && c.categoria === tipo.categoriaCompatible)
      .map((c) => ({ ...c, pisoNombre: piso.nombre }))
  );
}

export default function ModuloEntrada({ pisos, onEntradaRegistrada }) {
  const [placa,       setPlaca]       = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState('AUTOMOVIL');
  const [cajonId,     setCajonId]     = useState('');
  const [cargando,    setCargando]    = useState(false);
  const [resultado,   setResultado]   = useState(null); // { ok, mensaje, estancia }
  const [error,       setError]       = useState('');

  // Recalcular cajones al cambiar tipo de vehículo o pisos
  const cajones = cajonesCompatibles(pisos, tipoVehiculo);

  // Reset del cajón seleccionado cuando cambia tipo
  useEffect(() => {
    setCajonId(cajones.length > 0 ? cajones[0].id : '');
  }, [tipoVehiculo, pisos]);

  // Limpiar resultado tras 8 segundos
  useEffect(() => {
    if (resultado) {
      const t = setTimeout(() => setResultado(null), 8000);
      return () => clearTimeout(t);
    }
  }, [resultado]);

  /** Simula el escáner OCR rellenando la placa con un valor de demo. */
  function simularOCR() {
    const demos = ['ABC123', 'XYZ789', 'DEF456', 'GHI321'];
    setPlaca(demos[Math.floor(Math.random() * demos.length)]);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResultado(null);

    if (!placa.trim()) return setError('Ingresa la placa del vehículo');
    if (!cajonId)       return setError('No hay cajones disponibles para este tipo de vehículo');

    setCargando(true);
    try {
      const estancia = await registrarEntrada({ placa, tipoVehiculo, cajonId });
      setResultado({ estancia });
      setPlaca('');
      onEntradaRegistrada?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Placa */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Placa del vehículo
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={placa}
              maxLength={10}
              placeholder="Ej. ABC-123"
              onChange={(e) => {
                setPlaca(e.target.value.toUpperCase());
                setError('');
              }}
              className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300
                         text-slate-800 font-mono text-sm uppercase tracking-widest
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                         placeholder:normal-case placeholder:tracking-normal placeholder:font-sans
                         placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={simularOCR}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300
                         text-slate-600 text-sm hover:bg-slate-50 hover:border-slate-400
                         transition-colors whitespace-nowrap"
              title="Simular escaneo OCR"
            >
              <ScanLine size={15} />
              <span className="hidden sm:inline">Escanear OCR</span>
            </button>
          </div>
        </div>

        {/* Tipo de vehículo */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Tipo de vehículo
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS_VEHICULO.map(({ value, label, icon: Icono }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTipoVehiculo(value)}
                className={`
                  flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border-2
                  text-xs font-medium transition-all
                  ${tipoVehiculo === value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }
                `}
              >
                <Icono size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cajón compatible */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Cajón disponible
            {cajones.length > 0 && (
              <span className="ml-2 text-xs font-normal text-emerald-600">
                {cajones.length} libre{cajones.length !== 1 ? 's' : ''}
              </span>
            )}
          </label>
          {cajones.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={15} />
              Sin cajones disponibles para este tipo de vehículo
            </div>
          ) : (
            <select
              value={cajonId}
              onChange={(e) => setCajonId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-slate-800
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-indigo-500"
            >
              {cajones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.pisoNombre} ({c.categoria})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={cargando || cajones.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                     bg-indigo-600 text-white text-sm font-semibold
                     hover:bg-indigo-700 active:bg-indigo-800
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          <LogIn size={16} />
          {cargando ? 'Registrando…' : 'Registrar Ingreso'}
        </button>
      </form>

      {/* Comprobante de entrada */}
      {resultado && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <CheckCircle2 size={16} />
            Ingreso registrado correctamente
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="font-medium">Placa</span>
            <span className="font-mono font-bold text-slate-800">{resultado.estancia.placa}</span>
            <span className="font-medium">Cajón</span>
            <span>{resultado.estancia.codigoCajon}</span>
            <span className="font-medium">Vehículo</span>
            <span>{resultado.estancia.tipoVehiculo}</span>
            <span className="font-medium">Entrada</span>
            <span>{new Date(resultado.estancia.fechaEntrada).toLocaleTimeString('es-MX')}</span>
            <span className="font-medium">ID Estancia</span>
            <span className="font-mono text-slate-500 truncate">{resultado.estancia.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}
