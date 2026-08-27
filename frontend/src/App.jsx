import React, { useState, useEffect } from 'react'
import './index.css'
import { useAuth } from './lib/AuthProvider'
import Login from './components/Login'
import UpdatePassword from './components/UpdatePassword'
import Logo from './components/Logo'
import DocumentosPanel from './components/DocumentosPanel'
import { listProyectos, createProyecto, updateProyecto } from './lib/proyectosApi'

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
]

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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);

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

  // Ranking Top 8 por avance
  const ranking = [...vistaProyectos]
    .filter(p => p.avance !== undefined && p.avance !== null)
    .sort((a, b) => (b.avance || 0) - (a.avance || 0))
    .slice(0, 8);

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

  // --- Comparativo Sede Central vs Territorial (usa TODOS los proyectos, sin filtros ni pestaña) ---
  const resumenSede = (nombreSede) => {
    const grupo = nombreSede === 'Sede Central'
      ? proyectos.filter(p => p.sede === 'Sede Central')
      : proyectos.filter(p => p.sede !== 'Sede Central');
    const conAvance = grupo.filter(p => p.avance !== undefined && p.avance !== null);
    const avancePromedio = conAvance.length ? conAvance.reduce((s, p) => s + (p.avance || 0), 0) / conAvance.length : 0;
    const valor = grupo.reduce((s, p) => s + (p.valorContrato || 0), 0);
    const ejecucion = grupo.filter(p => (p.statusActual || '').toUpperCase().includes('EJECUCI')).length;
    return { total: grupo.length, avancePromedio, valor, ejecucion };
  };
  const resumenCentral = resumenSede('Sede Central');
  const resumenTerritorial = resumenSede('Territorial');

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      tipo: '',
      statusActual: 'EN ESTRUCTURACION',
      fase: 'necesidad',
      tecnico: '',
      valorContrato: '',
      avance: 0,
      sede: tab === 'sede' ? 'Sede Central' : 'Territorial',
      verificado: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (proyecto, e) => {
    e.stopPropagation();
    setEditingId(proyecto.id);
    setFormData({
      nombre: proyecto.nombre,
      tipo: proyecto.tipo || '',
      statusActual: proyecto.statusActual || '',
      fase: proyecto.fase || 'necesidad',
      tecnico: proyecto.tecnico || '',
      // ?? y no || : un valor nulo debe quedar vacío, NO convertirse en 0
      // (perderíamos la diferencia entre "sin valor registrado" y "vale $0").
      valorContrato: proyecto.valorContrato ?? '',
      avance: proyecto.avance || 0,
      sede: proyecto.sede,
      objeto: proyecto.objeto || '',
      observaciones: proyecto.observaciones || '',
      juridico: proyecto.juridico || '',
      abogado: proyecto.abogado || '',
      verificado: proyecto.verificado ?? true,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val;
    if (type === 'checkbox') {
      val = checked;
    } else if (name === 'avance') {
      val = Math.max(0, Math.min(100, parseFloat(value) || 0));
    } else if (name === 'valorContrato') {
      // Vacío se conserva vacío (se guardará como NULL), no como 0.
      val = value === '' ? '' : (parseFloat(value) || 0);
    } else {
      val = value;
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateProyecto(editingId, formData);
      } else {
        const id = 'P' + Date.now().toString(36).toUpperCase();
        await createProyecto({ id, ...formData });
      }
      fetchProyectos();
      closeModal();
    } catch (err) {
      console.error("Error saving proyecto", err);
      alert('No se pudo guardar: ' + err.message);
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
    const cols = ['id', 'nombre', 'sede', 'tipo', 'fase', 'statusActual', 'tecnico', 'valorContrato', 'avance', 'objeto', 'observaciones', 'juridico', 'abogado'];
    const encabezados = ['ID', 'Nombre', 'Sede', 'Tipo de proceso', 'Fase', 'Estado', 'Técnico', 'Valor estimado', 'Avance %', 'Objeto', 'Observaciones', 'Jurídico', 'Abogado'];
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
    <div className="min-h-screen pb-16 relative bg-bg text-ink font-sans">
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
            </div>
            <div className="text-right leading-tight border-l border-white/10 pl-4">
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
          <div className="flex gap-3">
            <button
              onClick={exportarCSV}
              className="bg-white border border-navy text-navy hover:bg-navy hover:text-white font-semibold py-2.5 px-5 rounded-lg shadow-sm transition-colors text-sm tracking-wide"
            >
              ⬇ Exportar CSV
            </button>
            <button
              onClick={openAddModal}
              className="bg-navy hover:bg-navy-deep text-white font-semibold py-2.5 px-5 rounded-lg shadow transition-colors text-sm tracking-wide"
            >
              + Nuevo Proyecto
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
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
          <div className="flex items-baseline justify-between mb-4 gap-2">
            <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Proyectos con mayor avance</h3>
            <span className="text-[11.5px] text-ink-faint font-mono">ranking top 8</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {ranking.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[22px_1fr_46px] items-center gap-2">
                <div className="font-mono text-[11px] text-ink-faint font-bold">{i + 1}</div>
                <div className="truncate font-semibold text-[12.5px] text-ink flex items-baseline gap-1">
                  {p.nombre} <span className="text-[10.5px] text-ink-faint font-normal">{p.tecnico}</span>
                  {p.verificado === false && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Sin verificar</span>
                  )}
                </div>
                <div className="col-span-full h-1.5 bg-bg rounded overflow-hidden mt-[-4px]">
                  <div className="h-full bg-teal rounded" style={{ width: `${p.avance || 0}%` }}></div>
                </div>
              </div>
            ))}
            {!loading && ranking.length === 0 && <div className="text-ink-faint text-sm text-center py-4">No hay datos para rankear</div>}
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
                  <th className="p-3 bg-navy font-semibold text-[11px] uppercase tracking-wider text-white/80 border-b border-navy-deep"></th>
                </tr>
              </thead>
              <tbody>
                {vistaProyectos.map(p => (
                  <React.Fragment key={p.id}>
                    <tr onClick={() => toggleRow(p.id)} className="hover:bg-bg transition-colors cursor-pointer border-b border-border last:border-0 group">
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
                      <td className="p-3 text-right">
                        <button onClick={(e) => openEditModal(p, e)} className="text-ink-soft hover:text-navy px-2 py-1 rounded border border-transparent hover:border-border bg-transparent hover:bg-white transition-all text-xs font-semibold">
                          Editar
                        </button>
                      </td>
                    </tr>

                    {expandedRow === p.id && (
                      <tr className="bg-bg border-b border-border">
                        <td colSpan="7" className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2 rounded-lg bg-white border border-border">
                            <div className="flex flex-col gap-4">
                              <div>
                                <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-1">Objeto</h4>
                                <p className="text-sm text-ink-soft leading-relaxed">{p.objeto || 'No especificado.'}</p>
                              </div>
                              <div>
                                <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-1">Observaciones</h4>
                                <p className="text-sm text-ink-soft leading-relaxed">{p.observaciones || '-'}</p>
                              </div>
                              <div className="flex gap-4">
                                <div>
                                  <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-1">Jurídico</h4>
                                  <p className="text-sm text-ink-soft">{p.juridico || '-'}</p>
                                </div>
                                <div>
                                  <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-1">Abogado</h4>
                                  <p className="text-sm text-ink-soft">{p.abogado || '-'}</p>
                                </div>
                              </div>
                            </div>
                            <div className="border-l border-border pl-6">
                              <DocumentosPanel proyecto={p} onSaved={fetchProyectos} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!loading && vistaProyectos.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-ink-faint">{filtrosActivos ? 'Ningún proyecto coincide con los filtros.' : 'No hay proyectos para esta sede.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-card rounded-[10px] shadow-xl w-full max-w-lg border border-border overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-navy shrink-0">
              <h3 className="font-serif text-lg font-semibold text-white">{editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
              <button onClick={closeModal} className="text-white/60 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Nombre del Proyecto</label>
                <input required type="text" name="nombre" value={formData.nombre || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Ej. Adecuación de aulas..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Tipo de Proceso</label>
                  <select name="tipo" value={formData.tipo || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="">Seleccione...</option>
                    {TIPOS_PROCESO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Estado</label>
                  <select name="statusActual" value={formData.statusActual || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="">Seleccione...</option>
                    {ESTADOS_PROCESO.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Fase</label>
                  <select name="fase" value={formData.fase || 'necesidad'} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    {FASES_EMBUDO.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Sede</label>
                  <select name="sede" value={formData.sede || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="Sede Central">Sede Central</option>
                    <option value="Territorial">Territorial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Técnico a cargo</label>
                  <input type="text" name="tecnico" value={formData.tecnico || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Valor Estimado</label>
                  <input type="number" name="valorContrato" value={formData.valorContrato ?? ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Déjalo vacío si aún no hay valor" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Avance documental (%)</label>
                <input type="number" min="0" max="100" name="avance" value={formData.avance || 0} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Objeto</label>
                <textarea name="objeto" value={formData.objeto || ''} onChange={handleInputChange} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white resize-y" placeholder="Descripción del objeto contractual..." />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Observaciones</label>
                <textarea name="observaciones" value={formData.observaciones || ''} onChange={handleInputChange} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white resize-y" placeholder="Notas, alertas, seguimiento..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Jurídico</label>
                  <input type="text" name="juridico" value={formData.juridico || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Nombre" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Abogado</label>
                  <input type="text" name="abogado" value={formData.abogado || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Nombre" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12.5px] text-ink-soft select-none">
                <input type="checkbox" name="verificado" checked={formData.verificado ?? true} onChange={handleInputChange} className="w-4 h-4 accent-teal" />
                Dato verificado por el equipo GIM (desmárcalo si aún falta confirmar la información)
              </label>

              <div className="mt-4 flex gap-3 justify-end">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-soft hover:bg-bg transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-navy hover:bg-navy-deep transition-colors shadow-sm">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
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
