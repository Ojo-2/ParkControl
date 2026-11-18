import { useEffect, useRef } from 'react';
import { Car, Bike, Wrench, RefreshCw } from 'lucide-react';

/** Mapa de colores y etiquetas según el estado del cajón. */
const ESTADO_CONFIG = {
  DISPONIBLE: {
    card:  'bg-emerald-50 border-emerald-300 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    dot:   'bg-emerald-400',
    label: 'Libre',
  },
  OCUPADO: {
    card:  'bg-red-50 border-red-300 hover:border-red-400',
    badge: 'bg-red-100 text-red-700',
    dot:   'bg-red-400',
    label: 'Ocupado',
  },
  MANTENIMIENTO: {
    card:  'bg-amber-50 border-amber-300 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    dot:   'bg-amber-400',
    label: 'Mtto.',
  },
};

/** Icono y color de texto según categoría de cajón. */
function IconoCategoria({ categoria }) {
  if (categoria === 'MOTOCICLETA') {
    return <Bike size={20} className="text-indigo-500" />;
  }
  return <Car size={20} className="text-slate-500" />;
}

/** Tarjeta individual de un cajón. */
function TarjetaCajon({ cajon }) {
  const cfg = ESTADO_CONFIG[cajon.estado] ?? ESTADO_CONFIG.DISPONIBLE;

  return (
    <div
      className={`
        relative flex flex-col items-center justify-between
        rounded-xl border-2 p-3 gap-1 cursor-default
        transition-all duration-200 select-none
        ${cfg.card}
      `}
      title={`${cajon.codigo} · ${cajon.categoria} · ${cajon.estado}`}
    >
      {/* Dot de estado (esquina superior derecha) */}
      <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />

      {/* Icono de categoría */}
      <IconoCategoria categoria={cajon.categoria} />

      {/* Código del cajón */}
      <span className="text-xs font-bold text-slate-700 tracking-wide">
        {cajon.codigo}
      </span>

      {/* Badge de estado */}
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
        {cfg.label}
      </span>
    </div>
  );
}

/** Tarjeta de resumen por piso. */
function ResumenPiso({ resumen }) {
  return (
    <div className="flex gap-3 text-xs font-medium flex-wrap">
      <span className="flex items-center gap-1 text-emerald-700">
        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
        {resumen.disponibles} libre{resumen.disponibles !== 1 ? 's' : ''}
      </span>
      <span className="flex items-center gap-1 text-red-700">
        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
        {resumen.ocupados} ocupado{resumen.ocupados !== 1 ? 's' : ''}
      </span>
      {resumen.mantenimiento > 0 && (
        <span className="flex items-center gap-1 text-amber-700">
          <Wrench size={11} />
          {resumen.mantenimiento} mtto.
        </span>
      )}
    </div>
  );
}

/**
 * TableroCajones
 * Recibe `pisos` (array del endpoint GET /api/infraestructura/cajones)
 * y `onRefresh` (función para volver a cargar los datos).
 */
export default function TableroCajones({ pisos, onRefresh, cargando }) {
  // Referencia para hacer scroll automático al primer cajón ocupado (opcional)
  const ref = useRef(null);

  // Cuando los datos cambien podemos animar brevemente
  useEffect(() => {
    if (ref.current) {
      ref.current.classList.add('animate-pulse');
      const t = setTimeout(() => ref.current?.classList.remove('animate-pulse'), 500);
      return () => clearTimeout(t);
    }
  }, [pisos]);

  if (!pisos || pisos.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        Sin datos de infraestructura
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-5">
      {/* Encabezado con botón de refresco */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Mapa de Ocupación
        </h3>
        <button
          onClick={onRefresh}
          disabled={cargando}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600
                     transition-colors disabled:opacity-40"
          title="Actualizar tablero"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Car size={13} className="text-slate-400" /> Automóvil
        </span>
        <span className="flex items-center gap-1.5">
          <Bike size={13} className="text-indigo-400" /> Motocicleta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Ocupado
        </span>
      </div>

      {/* Grid por piso */}
      {pisos.map((piso) => (
        <section key={piso.id} className="space-y-3">
          {/* Encabezado del piso */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-sm font-semibold text-slate-700">
              {piso.nombre}
            </span>
            <ResumenPiso resumen={piso.resumen} />
          </div>

          {/* Grid de tarjetas */}
          {piso.cajones.length === 0 ? (
            <p className="text-xs text-slate-400 pl-1">Sin cajones registrados</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {piso.cajones.map((cajon) => (
                <TarjetaCajon key={cajon.id} cajon={cajon} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
