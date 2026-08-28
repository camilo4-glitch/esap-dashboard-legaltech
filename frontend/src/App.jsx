import React, { useState, useEffect } from 'react'
import './index.css'
import { useAuth } from './lib/AuthProvider'
import Login from './components/Login'
import UpdatePassword from './components/UpdatePassword'
import Logo from './components/Logo'
import FichaProyecto from './components/FichaProyecto'
import EditorProyecto from './components/EditorProyecto'
import MapaSedes from './components/MapaSedes'
import VistaEjecutiva from './components/VistaEjecutiva'
import PapeleraPanel from './components/PapeleraPanel'
import { listProyectos, createProyecto, updateProyecto, listTerminos, guardarTermino, enviarAPapelera } from './lib/proyectosApi'

// --- Vocabularios canónicos ---------------------------------------------
// Estas listas son la ÚNICA fuente de verdad para los desplegables del
// formulario. Deben escribirse igual que los valores guardados en la base,
// si no el desplegable aparece en blanco al editar y se crean variantes
// ortográficas del mismo tipo de proceso (p. ej. "Cuantía" vs "Cuantia").
const TIPOS_PROCESO = [
  'Selección Abreviada de Menor Cuantía',
  'Subasta Inversa',
  'Licitación',
  'Concurso de Méritos',
  'Mínima Cuantía',
  'Contratación Directa',
]

const ESTADOS_PROCESO = [
  'SIN INICIAR',
  'EN ESTRUCTURACIÓN',
  'EN PROYECCIÓN',
  'EN AJUSTE',
  'EN REVISIÓN',
  'EN TRÁMITE',
  'EN ADJUDICACIÓN',
  'EN EJECUCIÓN',
  'CONGELADO',
  'LIQUIDADO',
]

// Fases del embudo precontractual. El `key` es lo que se guarda en la
// columna `fase`; el `label` es lo que ve el usuario.
const FASES_EMBUDO = [
  { key: 'necesidad', label: 'Sin iniciar', color: '#b8c4dc' },
  { key: 'estructuracion', label: 'Estructuración', color: '#8ea3c9' },
  { key: 'fase1', label: 'Fase 1 · Anexos', color: '#5c7ab0' },
  { key: 'fase2', label: 'Fase 2 · Estudios', color: '#37568f' },
  { key: 'fase3', label: 'Fase 3 · Adjudicación', color: '#1f3a6b' },
  { key: 'ejecucion', label: 'Ejecución', color: '#0A1730' },
  { key: 'liquidacion', label: 'Liquidación', color: '#B08D3F' },
]

// Cada etapa mide el avance con su propia unidad. Sin esto, un proyecto en obra
// mostraba el porcentaje de sus documentos precontractuales como si fuera avance
// de ejecución.
const UNIDAD_AVANCE = {
  planeacion:     'estructuración',
  precontractual: 'estructuración',
  contractual:    'ejecución de obra',
  poscontractual: 'liquidación',
}

function Dashboard() {
  const { user, signOut } = useAuth()
  const [proyectos, setProyectos] = useState([]);
  const [tab, setTab] = useState('sede');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros (se aplican dentro de la sede/pestaña activa)
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  // Configuración de términos por fase
  const [terminosAbierto, setTerminosAbierto] = useState(false);
  const [terminos, setTerminos] = useState([]);
  const [guardandoTermino, setGuardandoTermino] = useState(false);

  const abrirTerminos = async () => {
    setTerminosAbierto(true);
    try { setTerminos(await listTerminos()); }
    catch (err) { setError('No se pudieron cargar los términos: ' + err.message); }
  };

  const cambiarTermino = async (fase, dias) => {
    setGuardandoTermino(true);
    try {
      await guardarTermino(fase, dias);
      setTerminos(await listTerminos());
      fetchProyectos();   // los vencimientos cambiaron
    } catch (err) {
      alert('No se pudo guardar el término: ' + err.message);
    } finally {
      setGuardandoTermino(false);
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [guardandoProyecto, setGuardandoProyecto] = useState(false);
  const [papeleraAbierta, setPapeleraAbierta] = useState(false);

  // Modo presentación: oculta controles de edición y avisos internos, agranda
  // la tipografía y pasa a pantalla completa. Para proyectar ante terceros.
  const [presentacion, setPresentacion] = useState(false);

  const alternarPresentacion = () => {
    const entrando = !presentacion;
    setPresentacion(entrando);
    setExpandedRow(null);
    try {
      if (entrando && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!entrando && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch { /* la pantalla completa es opcional */ }
  };

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && presentacion) setPresentacion(false); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [presentacion]);

  const fetchProyectos = () => {
    setLoading(true);
    listProyectos()
      .then(data => { setProyectos(data); setError(''); })
      .catch(err => { console.error("Error fetching data: ", err); setError(err.message); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  // "Sede Central" en un tab, "Territoriales" + "Ejecución Territorial" en el otro
  const filteredProyectos = proyectos.filter(p =>
    tab === 'sede' ? p.sede === 'Sede Central' : p.sede !== 'Sede Central'
  );

  // Opciones de filtro, calculadas sobre la pestaña activa
  const opcionesTecnico = [...new Set(filteredProyectos.map(p => p.tecnico).filter(Boolean))].sort();
  const opcionesEstado = [...new Set(filteredProyectos.map(p => p.statusActual).filter(Boolean))].sort();
  const opcionesTipo = [...new Set(filteredProyectos.map(p => p.tipo).filter(Boolean))].sort();

  // Proyectos tras aplicar los filtros adicionales — esta es la base real de
  // KPIs, embudo, gráfico de estado, ranking y tabla.
  const vistaProyectos = filteredProyectos.filter(p =>
    (!filtroTecnico || p.tecnico === filtroTecnico) &&
    (!filtroEstado || p.statusActual === filtroEstado) &&
    (!filtroTipo || p.tipo === filtroTipo)
  );

  const limpiarFiltros = () => { setFiltroTecnico(''); setFiltroEstado(''); setFiltroTipo(''); };
  const filtrosActivos = !!(filtroTecnico || filtroEstado || filtroTipo);

  // Stats para KPIs
  const totalValor = vistaProyectos.reduce((sum, p) => sum + (p.valorContrato || 0), 0);
  const enEjecucion = vistaProyectos.filter(p => (p.statusActual || '').toUpperCase().includes('EJECUCION') || (p.statusActual || '').toUpperCase().includes('EJECUCIÓN')).length;
  const enTramite = vistaProyectos.length - enEjecucion;

  // Ranking Top 8 por avance vigente (el de la etapa en que está cada proyecto).
  // Solo proyectos que YA registran avance: listar ocho proyectos en 0 % no
  // dice nada y hacía que la tarjeta pareciera rota en la vista territorial.
  const ranking = [...vistaProyectos]
    .filter(p => (p.avanceVigente ?? p.avance ?? 0) > 0)
    .sort((a, b) => (b.avanceVigente ?? b.avance ?? 0) - (a.avanceVigente ?? a.avance ?? 0))
    .slice(0, 8);
  const conAvanceTotal = vistaProyectos.filter(p => (p.avanceVigente ?? p.avance ?? 0) > 0).length;

  // Abre el proyecto en la tabla de abajo y lo trae a la vista.
  const irAlProyecto = (id) => {
    setExpandedRow(id);
    requestAnimationFrame(() => {
      document.getElementById(`fila-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  // --- Embudo precontractual: cuántos proyectos hay en cada fase ---
  const embudo = FASES_EMBUDO.map(f => ({
    ...f,
    count: vistaProyectos.filter(p => (p.fase || 'necesidad') === f.key).length,
  }));
  const embudoMax = Math.max(1, ...embudo.map(f => f.count));

  // --- Distribución por estado ---
  const COLORES_ESTADO = {
    'SIN INICIAR': '#2a78d6',
    'EN ESTRUCTURACIÓN': '#eb6834',
    'EN EJECUCIÓN': '#1baf7a',
    'EN AJUSTE': '#eda100',
    'EN ADJUDICACIÓN': '#008300',
    'EN REVISIÓN': '#4a3aa7',
    'CONGELADO': '#e34948',
    'EN TRÁMITE': '#0f766e',
    'EN PROYECCIÓN': '#7c8ba1',
  };
  const colorEstado = (estado) => COLORES_ESTADO[(estado || '').toUpperCase()] || '#8892a6';
  const estadosCount = {};
  vistaProyectos.forEach(p => {
    const e = p.statusActual || 'SIN ESTADO';
    estadosCount[e] = (estadosCount[e] || 0) + 1;
  });
  const distribucionEstados = Object.entries(estadosCount)
    .map(([estado, count]) => ({ estado, count, color: colorEstado(estado) }))
    .sort((a, b) => b.count - a.count);
  const estadosMax = Math.max(1, ...distribucionEstados.map(e => e.count));

  // --- Puntos de atención: proyectos congelados ---
  const puntosAtencion = vistaProyectos.filter(p => (p.statusActual || '').toUpperCase() === 'CONGELADO');

  // --- Términos: vencidos y por vencer, ordenados por urgencia ---
  const vencidos = vistaProyectos
    .filter(p => p.semaforo === 'vencido')
    .sort((a, b) => (a.diasHabilesRestantes ?? 0) - (b.diasHabilesRestantes ?? 0));
  const porVencer = vistaProyectos
    .filter(p => p.semaforo === 'por_vencer')
    .sort((a, b) => (a.diasHabilesRestantes ?? 0) - (b.diasHabilesRestantes ?? 0));
  const enTermino = vistaProyectos.filter(p => p.semaforo === 'en_termino').length;
  const sinTermino = vistaProyectos.filter(p => p.semaforo === 'sin_termino').length;

  const textoPlazo = (p) => {
    if (p.semaforo === 'sin_termino') return 'Sin término';
    const d = p.diasHabilesRestantes;
    if (d === null || d === undefined) return 'Sin término';
    if (d < 0) return `Vencido hace ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'} hábil${Math.abs(d) === 1 ? '' : 'es'}`;
    if (d === 0) return 'Vence hoy';
    return `Faltan ${d} día${d === 1 ? '' : 's'} hábil${d === 1 ? '' : 'es'}`;
  };

  const ESTILO_SEMAFORO = {
    vencido:    { punto: '#e34948', texto: 'text-red-700',    fondo: 'bg-red-50 border-red-200' },
    por_vencer: { punto: '#eda100', texto: 'text-amber-700',  fondo: 'bg-amber-50 border-amber-200' },
    en_termino: { punto: '#1baf7a', texto: 'text-teal',       fondo: 'bg-white border-border' },
    sin_termino:{ punto: '#c3cad6', texto: 'text-ink-faint',  fondo: 'bg-white border-border' },
  };
  const estiloSemaforo = (s) => ESTILO_SEMAFORO[s] || ESTILO_SEMAFORO.sin_termino;

  const formatFecha = (f) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // --- Comparativo Sede Central vs Territorial (usa TODOS los proyectos, sin filtros ni pestaña) ---
  const resumenSede = (nombreSede) => {
    const grupo = nombreSede === 'Sede Central'
      ? proyectos.filter(p => p.sede === 'Sede Central')
      : proyectos.filter(p => p.sede !== 'Sede Central');
    const conAvance = grupo.filter(p => (p.avanceVigente ?? p.avance ?? 0) > 0);
    const avancePromedio = conAvance.length
      ? conAvance.reduce((s, p) => s + Number(p.avanceVigente ?? p.avance ?? 0), 0) / conAvance.length
      : 0;
    const valor = grupo.reduce((s, p) => s + (p.valorContrato || 0), 0);
    const ejecucion = grupo.filter(p => (p.statusActual || '').toUpperCase().includes('EJECUCI')).length;
    return { total: grupo.length, avancePromedio, valor, ejecucion };
  };
  const resumenCentral = resumenSede('Sede Central');
  const resumenTerritorial = resumenSede('Territorial');

  // El editor maneja TODOS los campos del proyecto. La ficha de consulta es
  // aparte y es de solo lectura.
  const CAMPOS_EDITABLES = [
    'nombre','tipo','statusActual','fase','sede','objeto','observaciones','verificado',
    'tecnico','abogado','financiero','apoyoSupervision','supervisor','contratista','equipoActual',
    'cdp','valorContrato',
    'adjudicado','adicion','valorAdicion','pagado','actasPago','retencion',
    'numeroSecop','secop','rutaDocumentos',
    'faseDesde','fechaLimiteManual','fechaInicio','fechaFin','fechaActaFinal',
  ];

  const abrirNuevo = () => {
    setEditingId(null);
    setFormData({
      nombre: '', tipo: '', statusActual: 'SIN INICIAR', fase: 'necesidad',
      tecnico: '', valorContrato: '',
      sede: tab === 'sede' ? 'Sede Central' : 'Territorial',
      verificado: true,
    });
    setIsModalOpen(true);
  };

  const abrirEditor = (proyecto, e) => {
    e?.stopPropagation?.();
    setEditingId(proyecto.id);
    const datos = {};
    for (const c of CAMPOS_EDITABLES) {
      const v = proyecto[c];
      datos[c] = v === null || v === undefined ? (typeof v === 'boolean' ? v : '') : v;
    }
    // Los booleanos deben conservar false, no volverse cadena vacía.
    datos.verificado  = proyecto.verificado ?? true;
    datos.adjudicado  = !!proyecto.adjudicado;
    datos.adicion     = !!proyecto.adicion;
    datos.fase        = proyecto.fase || 'necesidad';
    setFormData(datos);
    setIsModalOpen(true);
  };

  const cerrarEditor = () => setIsModalOpen(false);

  // Papelera: no borra la fila, solo la marca. Las vistas la dejan de mostrar,
  // pero historial, actividades y reportes de obra siguen ahí y se restauran
  // completos desde el botón «Papelera».
  const mandarAPapelera = async (id) => {
    try {
      await enviarAPapelera(id);
      setIsModalOpen(false);
      setExpandedRow(null);
      fetchProyectos();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val;
    if (type === 'checkbox') {
      val = checked;
    } else if (['valorContrato','cdp','valorAdicion','pagado','actasPago','retencion'].includes(name)) {
      // Vacío se conserva vacío (se guardará como NULL), no como 0.
      val = value === '' ? '' : (parseFloat(value) || 0);
    } else {
      val = value;
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setGuardandoProyecto(true);
    try {
      if (editingId) {
        await updateProyecto(editingId, formData);
      } else {
        const id = 'P' + Date.now().toString(36).toUpperCase();
        await createProyecto({ id, ...formData });
      }
      fetchProyectos();
      cerrarEditor();
    } catch (err) {
      console.error("Error saving proyecto", err);
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setGuardandoProyecto(false);
    }
  };

  const formatMoney = (val) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return `$${val.toLocaleString('es-CO')}`;
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const proyectoExpandido = proyectos.find(p => p.id === expandedRow);

  const exportarCSV = () => {
    const cols = ['id', 'nombre', 'sede', 'tipo', 'fase', 'statusActual', 'tecnico', 'valorContrato', 'avance', 'objeto', 'observaciones', 'abogado'];
    const encabezados = ['ID', 'Nombre', 'Sede', 'Tipo de proceso', 'Fase', 'Estado', 'Técnico', 'Valor estimado', 'Avance %', 'Objeto', 'Observaciones', 'Abogado a cargo'];
    const escapar = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const filas = [encabezados.join(';'), ...vistaProyectos.map(p => cols.map(c => escapar(p[c])).join(';'))];
    const csv = '﻿' + filas.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `proyectos-gim-${tab === 'sede' ? 'sede-central' : 'territoriales'}-${fecha}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen pb-16 relative bg-bg text-ink font-sans ${presentacion ? "modo-presentacion" : ""}`}>
      {/* Franja superior de acento */}
      <div className="h-[3px] bg-gradient-to-r from-navy-deep via-gold to-navy-deep" />

      {/* Topbar */}
      <div className="sticky top-0 z-40 bg-navy border-b border-navy-deep shadow-lg">
        <div className="max-w-[1360px] mx-auto px-6 py-3.5 flex items-center justify-between flex-wrap gap-4">
          <Logo />

          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                className={`px-4 py-2 rounded-lg font-semibold text-[13.5px] transition-colors ${tab === 'sede' ? 'bg-gold text-navy-deep shadow' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                onClick={() => setTab('sede')}
              >
                Sede Central
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-semibold text-[13.5px] transition-colors ${tab === 'territorial' ? 'bg-gold text-navy-deep shadow' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                onClick={() => setTab('territorial')}
              >
                Territoriales
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-semibold text-[13.5px] transition-colors ${tab === 'mapa' ? 'bg-gold text-navy-deep shadow' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                onClick={() => setTab('mapa')}
              >
                Mapa
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-semibold text-[13.5px] transition-colors ${tab === 'ejecutiva' ? 'bg-gold text-navy-deep shadow' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                onClick={() => setTab('ejecutiva')}
              >
                Ejecutiva
              </button>
            </div>
            <button
              onClick={alternarPresentacion}
              title={presentacion ? 'Salir (Esc)' : 'Modo presentación'}
              className="px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-white/20 bg-white/5 text-white/80 hover:bg-gold hover:text-navy-deep hover:border-gold transition-colors cursor-pointer"
            >
              {presentacion ? 'Salir' : 'Presentar'}
            </button>
            <div className="text-right leading-tight border-l border-white/10 pl-4 no-presentar">
              <div className="text-[12px] font-semibold text-white">{user?.email}</div>
              <button onClick={signOut} className="text-[11px] text-white/50 hover:text-gold underline">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1360px] mx-auto px-6 pt-7">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            Error cargando proyectos: {error}
          </div>
        )}

        {tab === 'ejecutiva' ? (
          <VistaEjecutiva proyectos={proyectos} fases={FASES_EMBUDO} colorEstado={colorEstado} />
        ) : tab === 'mapa' ? (
          <>
            <div className="mb-6">
              <h2 className="font-serif text-[28px] font-semibold mb-1 tracking-tight text-navy-deep">
                Ubicación de sedes <span className="text-gold">—</span> ESAP
              </h2>
              <p className="text-ink-soft text-sm max-w-2xl">
                Sede central, direcciones territoriales y CETAP, con los proyectos de infraestructura
                que se adelantan en cada una.
              </p>
            </div>
            <MapaSedes proyectos={proyectos} presentacion={presentacion} />
          </>
        ) : (
        <>

        {/* Comparativo Sede Central vs Territorial — vista general, no depende de la pestaña activa */}
        <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm mb-6">
          <div className="flex items-baseline justify-between mb-4 gap-2">
            <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Vista general — Sede Central vs. Territorial</h3>
            <span className="text-[11.5px] text-ink-faint font-mono">toda la cartera, {proyectos.length} proyectos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ label: 'Sede Central', r: resumenCentral, accent: 'bg-navy' }, { label: 'Territorial', r: resumenTerritorial, accent: 'bg-teal' }].map(({ label, r, accent }) => (
              <div key={label} className="border border-border rounded-lg p-4 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent}`}></div>
                <div className="font-serif text-[15px] font-semibold text-navy-deep mb-3">{label}</div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">Proyectos</div>
                    <div className="font-serif text-xl font-semibold text-navy-deep">{loading ? '…' : r.total}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">Avance prom.</div>
                    <div className="font-serif text-xl font-semibold text-navy-deep">{loading ? '…' : `${r.avancePromedio.toFixed(1)}%`}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">En ejecución</div>
                    <div className="font-serif text-xl font-semibold text-navy-deep">{loading ? '…' : r.ejecucion}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">Valor</div>
                    <div className="font-serif text-xl font-semibold text-navy-deep">{loading ? '…' : formatMoney(r.valor)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
          <div>
            <h2 className="font-serif text-[28px] font-semibold mb-1 tracking-tight text-navy-deep">{tab === 'sede' ? 'Sede Central CAN' : 'Direcciones Territoriales'} <span className="text-gold">—</span> Proyectos</h2>
            <p className="text-ink-soft text-sm max-w-2xl">Ruta de estructuración de los proyectos desde la fase inicial hasta el acta de inicio.</p>
          </div>
          <div className="flex gap-3 no-presentar">
            <button
              onClick={() => setPapeleraAbierta(true)}
              title="Proyectos retirados de los tableros"
              className="bg-white border border-border text-ink-soft hover:border-navy hover:text-navy font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors text-sm tracking-wide"
            >
              Papelera
            </button>
            <button
              onClick={exportarCSV}
              className="bg-white border border-navy text-navy hover:bg-navy hover:text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-colors text-sm tracking-wide"
            >
              ⬇ Exportar CSV
            </button>
            <button
              onClick={abrirNuevo}
              className="bg-navy hover:bg-navy-deep text-white font-semibold py-2.5 px-5 rounded-lg shadow transition-colors text-sm tracking-wide"
            >
              + Nuevo Proyecto
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="no-presentar flex flex-wrap items-center gap-3 mb-6">
          <select value={filtroTecnico} onChange={(e) => setFiltroTecnico(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-[12.5px] bg-white focus:outline-none focus:border-teal">
            <option value="">Técnico: todos</option>
            {opcionesTecnico.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-[12.5px] bg-white focus:outline-none focus:border-teal">
            <option value="">Estado: todos</option>
            {opcionesEstado.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-[12.5px] bg-white focus:outline-none focus:border-teal">
            <option value="">Tipo de proceso: todos</option>
            {opcionesTipo.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {filtrosActivos && (
            <button onClick={limpiarFiltros} className="text-[12.5px] text-navy hover:text-navy-deep underline font-semibold">
              Limpiar filtros
            </button>
          )}
          {filtrosActivos && (
            <span className="text-[11.5px] text-ink-faint font-mono ml-auto">{vistaProyectos.length} de {filteredProyectos.length} proyectos</span>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-navy">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">Total Proyectos</div>
            <div className="font-serif text-3xl font-semibold text-navy-deep mt-1.5">{loading ? '…' : vistaProyectos.length}</div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-teal">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">En Ejecución</div>
            <div className="font-serif text-3xl font-semibold text-navy-deep mt-1.5">{loading ? '…' : enEjecucion}</div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-gold">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">En Trámite (Precontractual)</div>
            <div className="font-serif text-3xl font-semibold text-navy-deep mt-1.5">{loading ? '…' : enTramite}</div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-purple">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">Valor Estimado</div>
            <div className="font-serif text-3xl font-semibold text-navy-deep mt-1.5">{loading ? '…' : formatMoney(totalValor)}</div>
          </div>
        </div>

        {/* Términos: vencidos y por vencer */}
        {(vencidos.length > 0 || porVencer.length > 0) && (
          <div className="border border-border rounded-[10px] shadow-sm mb-6 overflow-hidden">
            <div className="flex items-baseline justify-between gap-2 px-5 py-3.5 bg-navy">
              <h3 className="font-serif text-[16px] font-semibold text-white m-0">Control de términos</h3>
              <span className="flex items-center gap-3">
                <span className="text-[11px] text-white/60 font-mono">
                  {enTermino} en término · {sinTermino} sin plazo
                </span>
                <button onClick={abrirTerminos} className="no-presentar text-[11px] text-gold hover:text-white underline bg-transparent border-0 cursor-pointer">
                  Configurar plazos
                </button>
              </span>
            </div>
            <div className="divide-y divide-border bg-card">
              {[...vencidos, ...porVencer].map(p => {
                const est = estiloSemaforo(p.semaforo);
                return (
                  <button
                    key={p.id}
                    onClick={() => irAlProyecto(p.id)}
                    className="w-full text-left flex items-center gap-3 px-5 py-3 bg-transparent border-0 cursor-pointer hover:bg-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 group"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: est.punto }}></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[13px] text-ink group-hover:text-navy transition-colors">{p.nombre}</span>
                      <span className="block text-[11px] text-ink-soft truncate">
                        {FASES_EMBUDO.find(f => f.key === p.fase)?.label || p.fase}
                        {p.tecnico ? ` · ${p.tecnico}` : ''}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`block text-[12px] font-semibold ${est.texto}`}>{textoPlazo(p)}</span>
                      <span className="block text-[10.5px] text-ink-faint font-mono">vence {formatFecha(p.fechaLimite)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Puntos de atención */}
        {puntosAtencion.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-[10px] p-5 shadow-sm mb-6">
            <div className="flex items-baseline justify-between mb-3 gap-2">
              <h3 className="font-serif text-[16px] font-semibold text-red-800 m-0">⚠ Puntos de atención — proyectos congelados</h3>
              <span className="text-[11.5px] text-red-700/70 font-mono">{puntosAtencion.length} proyecto{puntosAtencion.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              {puntosAtencion.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-white border border-red-100 rounded-lg px-3 py-2">
                  <div className="text-[13px] font-semibold text-ink">{p.nombre}</div>
                  <div className="text-[11.5px] text-ink-soft font-mono">{p.tecnico || 'Sin técnico asignado'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embudo precontractual + distribución por estado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm">
            <div className="flex items-baseline justify-between mb-4 gap-2">
              <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Embudo precontractual</h3>
              <span className="text-[11.5px] text-ink-faint font-mono">por fase</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {embudo.map(f => (
                <div key={f.key} className="grid grid-cols-[110px_1fr_28px] items-center gap-2">
                  <div className="text-[11px] text-ink-soft font-semibold truncate">{f.label}</div>
                  <div className="h-5 bg-bg rounded overflow-hidden">
                    <div className="h-full rounded flex items-center justify-end pr-1.5" style={{ width: `${(f.count / embudoMax) * 100}%`, background: f.color, minWidth: f.count > 0 ? '10px' : 0 }}></div>
                  </div>
                  <div className="text-[12px] font-mono font-semibold text-ink text-right">{f.count}</div>
                </div>
              ))}
              {!loading && vistaProyectos.length === 0 && <div className="text-ink-faint text-sm text-center py-4">Sin datos</div>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm">
            <div className="flex items-baseline justify-between mb-4 gap-2">
              <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Distribución por estado</h3>
              <span className="text-[11.5px] text-ink-faint font-mono">{vistaProyectos.length} proyectos</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {distribucionEstados.map(e => (
                <div key={e.estado} className="grid grid-cols-[130px_1fr_28px] items-center gap-2">
                  <div className="text-[11px] text-ink-soft font-semibold truncate flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }}></span>
                    {e.estado}
                  </div>
                  <div className="h-5 bg-bg rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(e.count / estadosMax) * 100}%`, background: e.color, minWidth: e.count > 0 ? '10px' : 0 }}></div>
                  </div>
                  <div className="text-[12px] font-mono font-semibold text-ink text-right">{e.count}</div>
                </div>
              ))}
              {!loading && distribucionEstados.length === 0 && <div className="text-ink-faint text-sm text-center py-4">Sin datos</div>}
            </div>
          </div>
        </div>

        {/* Ranking */}
        <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm flex flex-col mb-6">
          <div className="flex items-baseline justify-between mb-1 gap-2">
            <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Mayor avance de su etapa</h3>
            <span className="text-[11.5px] text-ink-faint font-mono">
              {conAvanceTotal > 8 ? `8 de ${conAvanceTotal} con avance` : `${conAvanceTotal} con avance`}
            </span>
          </div>
          <p className="text-[12px] text-ink-soft mb-4">
            Avance de la etapa en la que está cada proyecto: estructuración, ejecución de obra o liquidación. Haz clic para abrir su detalle.
          </p>
          <div className="flex flex-col gap-1">
            {ranking.map((p, i) => (
              <button
                key={p.id}
                onClick={() => irAlProyecto(p.id)}
                title={`Abrir ${p.nombre}`}
                className="w-full text-left grid grid-cols-[20px_1fr_auto] gap-x-3 gap-y-1.5 items-center py-2 px-2 -mx-2 rounded-lg bg-transparent border-0 cursor-pointer hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-colors group"
              >
                <span className="font-mono text-[11px] text-ink-faint font-bold">{i + 1}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-[13px] text-ink group-hover:text-navy transition-colors">{p.nombre}</span>
                    {p.verificado === false && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">Sin verificar</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorEstado(p.statusActual) }}></span>
                    <span className="text-[10.5px] text-ink-soft truncate">
                      {UNIDAD_AVANCE[p.etapaActual] || 'estructuración'}{p.tecnico ? ` · ${p.tecnico}` : ''}
                    </span>
                  </span>
                </span>
                <span className="font-serif text-[18px] font-semibold text-navy-deep tabular-nums">{p.avanceVigente ?? p.avance ?? 0}%</span>
                <span></span>
                <span className="col-span-2 h-1.5 bg-bg rounded overflow-hidden">
                  <span className="block h-full rounded" style={{ width: `${p.avanceVigente ?? p.avance ?? 0}%`, background: colorEstado(p.statusActual) }}></span>
                </span>
              </button>
            ))}
            {!loading && ranking.length === 0 && (
              <div className="text-ink-soft text-[13px] text-center py-5 leading-relaxed">
                Ningún proyecto de esta vista registra avance todavía.<br />
                <span className="text-ink-faint text-[12px]">El avance se calcula solo: marca actividades cumplidas o carga un reporte semanal de obra.</span>
              </div>
            )}
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm flex flex-col mt-4">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Tablero de proyectos detallado</h3>
            <span className="text-[11.5px] text-ink-faint font-mono">clic en una fila para ver detalle, SECOP y documentos</span>
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-[12.8px] text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Proyecto</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Tipo</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Fase</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Estado</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Técnico</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Valor</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep">Plazo</th>
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep"></th>
                </tr>
              </thead>
              <tbody>
                {vistaProyectos.map(p => (
                  <React.Fragment key={p.id}>
                    <tr id={`fila-${p.id}`} onClick={() => toggleRow(p.id)} className={`hover:bg-bg transition-colors cursor-pointer border-b border-border last:border-0 group ${expandedRow === p.id ? 'bg-bg' : ''}`}>
                      <td className="p-3 font-semibold text-ink group-hover:text-navy transition-colors">
                        <span className="flex items-center gap-2">
                          {p.nombre}
                          {p.verificado === false && (
                            <span title="Cargado automáticamente a partir del informe GIM; falta verificar con el equipo." className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded whitespace-nowrap">⚠ Sin verificar</span>
                          )}
                        </span>
                      </td>
                      <td className="p-3">{p.tipo || '-'}</td>
                      <td className="p-3">
                        <span className="font-mono text-[10.5px] uppercase text-ink-soft">{p.fase || '-'}</span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold text-white ${(p.statusActual || '').toUpperCase().includes('EJECUCI') ? 'bg-teal' : 'bg-navy'}`}>
                          {p.statusActual || 'SIN ESTADO'}
                        </span>
                      </td>
                      <td className="p-3">{p.tecnico || '-'}</td>
                      <td className="p-3 font-mono font-medium">{formatMoney(p.valorContrato)}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: estiloSemaforo(p.semaforo).punto }}></span>
                          <span className={`text-[11.5px] ${p.semaforo === 'vencido' ? 'font-semibold text-red-700' : p.semaforo === 'por_vencer' ? 'font-semibold text-amber-700' : 'text-ink-soft'}`}>
                            {p.semaforo === 'sin_termino' ? '—'
                              : p.diasHabilesRestantes < 0 ? `${Math.abs(p.diasHabilesRestantes)}d vencido`
                              : p.diasHabilesRestantes === 0 ? 'hoy'
                              : `${p.diasHabilesRestantes}d`}
                          </span>
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={(e) => abrirEditor(p, e)} className="no-presentar text-ink-soft hover:text-navy px-2 py-1 rounded border border-transparent hover:border-border bg-transparent hover:bg-white transition-all text-xs font-semibold">
                          Editar
                        </button>
                      </td>
                    </tr>

                    {expandedRow === p.id && (
                      <tr className="bg-bg border-b border-border">
                        <td colSpan="8" className="p-4">
                          <FichaProyecto
                            proyecto={p}
                            textoPlazo={textoPlazo}
                            formatFecha={formatFecha}
                            colorEstado={colorEstado}
                            onEditar={abrirEditor}
                            onSaved={fetchProyectos}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!loading && vistaProyectos.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-10 text-center text-ink-faint">{filtrosActivos ? 'Ningún proyecto coincide con los filtros.' : 'No hay proyectos para esta sede.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Configuración de términos por fase */}
      {terminosAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-card rounded-[10px] shadow-xl w-full max-w-md border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-navy">
              <h3 className="font-serif text-lg font-semibold text-white">Plazos por fase</h3>
              <button onClick={() => setTerminosAbierto(false)} className="text-white/60 hover:text-white bg-transparent border-0 cursor-pointer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-[12.5px] text-ink-soft mb-5 leading-relaxed">
                Días <b>hábiles</b> que puede durar cada fase, descontando fines de semana y
                festivos colombianos. Déjalo vacío para que la fase no tenga término.
                Al cambiar un plazo se recalculan todos los proyectos.
              </p>
              <div className="flex flex-col gap-3">
                {terminos.map(t => (
                  <div key={t.fase} className="flex items-center justify-between gap-4">
                    <label className="text-[13px] text-ink font-medium">{t.etiqueta}</label>
                    <span className="flex items-center gap-2">
                      <input
                        type="number" min="1" max="365"
                        defaultValue={t.dias_habiles ?? ''}
                        disabled={guardandoTermino}
                        onBlur={(e) => {
                          const v = e.target.value;
                          const actual = t.dias_habiles ?? '';
                          if (String(v) !== String(actual)) cambiarTermino(t.fase, v);
                        }}
                        className="w-20 border border-border rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:border-teal bg-white disabled:opacity-50"
                        placeholder="—"
                      />
                      <span className="text-[11.5px] text-ink-faint w-10">días</span>
                    </span>
                  </div>
                ))}
                {terminos.length === 0 && <p className="text-ink-faint text-sm">Cargando…</p>}
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setTerminosAbierto(false)} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-navy hover:bg-navy-deep transition-colors">
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor: panel de edición completo, independiente de la ficha */}
      {isModalOpen && (
        <EditorProyecto
          proyecto={editingId ? proyectos.find(p => p.id === editingId) : null}
          formData={formData}
          onChange={handleInputChange}
          onGuardar={handleSave}
          onCerrar={cerrarEditor}
          esNuevo={!editingId}
          tiposProceso={TIPOS_PROCESO}
          estadosProceso={ESTADOS_PROCESO}
          fases={FASES_EMBUDO}
          guardando={guardandoProyecto}
          onEliminar={mandarAPapelera}
        />
      )}

      {papeleraAbierta && (
        <PapeleraPanel
          onCerrar={() => setPapeleraAbierta(false)}
          onRestaurado={fetchProyectos}
        />
      )}

    </div>
  )
}

function App() {
  const { user, loading, passwordRecovery } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-bg text-ink-soft">Cargando…</div>;
  }
  // El enlace de "recuperar contraseña" abre una sesión temporal; hay que
  // mostrar el formulario de nueva contraseña antes que el dashboard normal.
  if (passwordRecovery) {
    return <UpdatePassword />;
  }
  if (!user) {
    return <Login />;
  }
  return <Dashboard />;
}

export default App
