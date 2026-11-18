import { useState, useEffect, useCallback } from 'react';
import { ParkingCircle, LayoutGrid, LogIn, LogOut, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { getMapaCajones } from './services/api.js';
import TableroCajones  from './components/TableroCajones.jsx';
import ModuloEntrada   from './components/ModuloEntrada.jsx';
import ModuloSalida    from './components/ModuloSalida.jsx';

/** Tabs del panel de operación */
const TABS = [
  { id: 'entrada', label: 'Registrar Entrada', icon: LogIn  },
  { id: 'salida',  label: 'Cobrar Salida',      icon: LogOut },
];

export default function App() {
  const [tabActiva,  setTabActiva]  = useState('entrada');
  const [pisos,      setPisos]      = useState([]);
  const [cargando,   setCargando]   = useState(false);
  const [error,      setError]      = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  /** Carga la matriz de cajones desde la API. */
  const cargarMapa = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await getMapaCajones();
      setPisos(data);
      setUltimaActualizacion(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    cargarMapa();
  }, [cargarMapa]);

  // Resumen global de ocupación
  const totalCajones    = pisos.flatMap((p) => p.cajones).length;
  const totalDisponibles = pisos.flatMap((p) => p.cajones).filter((c) => c.estado === 'DISPONIBLE').length;
  const totalOcupados   = pisos.flatMap((p) => p.cajones).filter((c) => c.estado === 'OCUPADO').length;
  const porcentajeOcupacion = totalCajones > 0 ? Math.round((totalOcupados / totalCajones) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100 font-sans">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

          {/* Logo + nombre */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ParkingCircle size={18} className="text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-slate-800 text-base tracking-tight">ParkControl</span>
              <span className="hidden sm:block text-xs text-slate-400">Panel de Operación de Caja</span>
            </div>
          </div>

          {/* Resumen de ocupación */}
          <div className="hidden md:flex items-center gap-5">
            <Stat label="Total cajones" valor={totalCajones} />
            <Stat label="Disponibles"   valor={totalDisponibles} color="text-emerald-600" />
            <Stat label="Ocupados"      valor={totalOcupados}    color="text-red-500" />
            {totalCajones > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${porcentajeOcupacion}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">{porcentajeOcupacion}%</span>
              </div>
            )}
          </div>

          {/* Estado de conexión + última actualización */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {error
              ? <span className="flex items-center gap-1 text-red-500"><WifiOff size={13} /> Sin conexión</span>
              : <span className="flex items-center gap-1 text-emerald-500"><Wifi size={13} /> En línea</span>
            }
            {ultimaActualizacion && (
              <span className="hidden sm:inline">
                Actualizado {ultimaActualizacion.toLocaleTimeString('es-MX')}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Panel izquierdo: Operación de caja ─────────────────────── */}
          <section className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                {TABS.map(({ id, label, icon: Icono }) => (
                  <button
                    key={id}
                    onClick={() => setTabActiva(id)}
                    className={`
                      flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium
                      transition-colors border-b-2 -mb-px
                      ${tabActiva === id
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }
                    `}
                  >
                    <Icono size={15} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Contenido del tab activo */}
              <div className="p-5">
                {tabActiva === 'entrada' && (
                  <ModuloEntrada
                    pisos={pisos}
                    onEntradaRegistrada={cargarMapa}
                  />
                )}
                {tabActiva === 'salida' && (
                  <ModuloSalida
                    onPagoRegistrado={cargarMapa}
                  />
                )}
              </div>
            </div>
          </section>

          {/* ── Panel derecho: Tablero de cajones ──────────────────────── */}
          <section className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              {/* Header del tablero */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <LayoutGrid size={16} className="text-indigo-500" />
                  Tablero de Ocupación en Tiempo Real
                </div>
                {/* Resumen móvil */}
                <div className="flex md:hidden items-center gap-3 text-xs font-medium">
                  <span className="text-emerald-600">{totalDisponibles} libre{totalDisponibles !== 1 ? 's' : ''}</span>
                  <span className="text-red-500">{totalOcupados} ocupado{totalOcupados !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Error de carga */}
              {error && (
                <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg
                                bg-red-50 border border-red-200 text-red-700 text-sm">
                  <WifiOff size={14} />
                  {error}
                  <button
                    onClick={cargarMapa}
                    className="ml-auto flex items-center gap-1 text-red-600 hover:text-red-800 font-medium text-xs"
                  >
                    <RefreshCw size={12} /> Reintentar
                  </button>
                </div>
              )}

              <div className="p-5">
                <TableroCajones
                  pisos={pisos}
                  onRefresh={cargarMapa}
                  cargando={cargando}
                />
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="text-center text-xs text-slate-400 py-6">
        ParkControl v2.0 · Backend{' '}
        <span className="font-mono">localhost:3000</span>
      </footer>
    </div>
  );
}

/** Mini componente de estadística en el header */
function Stat({ label, valor, color = 'text-slate-800' }) {
  return (
    <div className="text-center leading-tight">
      <div className={`text-lg font-bold ${color}`}>{valor}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
