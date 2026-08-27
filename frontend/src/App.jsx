import React, { useState, useEffect } from 'react'
import './index.css'
import { useAuth } from './lib/AuthProvider'
import Login from './components/Login'
import Logo from './components/Logo'
import DocumentosPanel from './components/DocumentosPanel'
import { listProyectos, createProyecto, updateProyecto } from './lib/proyectosApi'

function Dashboard() {
  const { user, signOut } = useAuth()
  const [proyectos, setProyectos] = useState([]);
  const [tab, setTab] = useState('sede');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // Stats para KPIs
  const totalValor = filteredProyectos.reduce((sum, p) => sum + (p.valorContrato || 0), 0);
  const enEjecucion = filteredProyectos.filter(p => (p.statusActual || '').toUpperCase().includes('EJECUCION') || (p.statusActual || '').toUpperCase().includes('EJECUCIÓN')).length;
  const enTramite = filteredProyectos.length - enEjecucion;

  // Ranking Top 8 por avance
  const ranking = [...filteredProyectos]
    .filter(p => p.avance !== undefined && p.avance !== null)
    .sort((a, b) => (b.avance || 0) - (a.avance || 0))
    .slice(0, 8);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      tipo: '',
      statusActual: 'EN ESTRUCTURACION',
      fase: 'necesidad',
      tecnico: '',
      valorContrato: 0,
      avance: 0,
      sede: tab === 'sede' ? 'Sede Central' : 'Territoriales',
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
      tecnico: proyecto.tecnico || '',
      valorContrato: proyecto.valorContrato || 0,
      avance: proyecto.avance || 0,
      sede: proyecto.sede,
      objeto: proyecto.objeto || '',
      observaciones: proyecto.observaciones || '',
      juridico: proyecto.juridico || '',
      abogado: proyecto.abogado || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numeric = name === 'valorContrato' || name === 'avance';
    setFormData(prev => ({ ...prev, [name]: numeric ? (parseFloat(value) || 0) : value }));
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

        <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
          <div>
            <h2 className="font-serif text-[28px] font-semibold mb-1 tracking-tight text-navy-deep">{tab === 'sede' ? 'Sede Central CAN' : 'Direcciones Territoriales'} <span className="text-gold">—</span> Proyectos</h2>
            <p className="text-ink-soft text-sm max-w-2xl">Ruta de estructuración de los proyectos desde la fase inicial hasta el acta de inicio.</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-navy hover:bg-navy-deep text-white font-semibold py-2.5 px-5 rounded-lg shadow transition-colors text-sm tracking-wide"
          >
            + Nuevo Proyecto
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-navy">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">Total Proyectos</div>
            <div className="font-serif text-3xl font-semibold text-navy-deep mt-1.5">{loading ? '…' : filteredProyectos.length}</div>
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
                {filteredProyectos.map(p => (
                  <React.Fragment key={p.id}>
                    <tr onClick={() => toggleRow(p.id)} className="hover:bg-bg transition-colors cursor-pointer border-b border-border last:border-0 group">
                      <td className="p-3 font-semibold text-ink group-hover:text-navy transition-colors">{p.nombre}</td>
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
                {!loading && filteredProyectos.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-ink-faint">No hay proyectos para esta sede.</td>
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
          <div className="bg-card rounded-[10px] shadow-xl w-full max-w-md border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-navy">
              <h3 className="font-serif text-lg font-semibold text-white">{editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
              <button onClick={closeModal} className="text-white/60 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Nombre del Proyecto</label>
                <input required type="text" name="nombre" value={formData.nombre || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Ej. Adecuación de aulas..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Tipo de Proceso</label>
                  <select name="tipo" value={formData.tipo || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="">Seleccione...</option>
                    <option value="Licitacion Publica">Licitación</option>
                    <option value="Selección Abreviada De Menor Cuantia">Selección abreviada</option>
                    <option value="Concurso De Meritos">Concurso de méritos</option>
                    <option value="Minima">Mínima cuantía</option>
                    <option value="Contratacion Directa">Contratación directa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Estado</label>
                  <input type="text" name="statusActual" value={formData.statusActual || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Ej. EN ESTRUCTURACION" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Técnico a cargo</label>
                  <input required type="text" name="tecnico" value={formData.tecnico || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Valor Estimado</label>
                  <input required type="number" name="valorContrato" value={formData.valorContrato || 0} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Ej. 150000000" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Avance (%)</label>
                  <input type="number" min="0" max="100" name="avance" value={formData.avance || 0} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Sede</label>
                  <select name="sede" value={formData.sede || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="Sede Central">Sede Central</option>
                    <option value="Territoriales">Territorial GIM</option>
                    <option value="Ejecución Territorial">Ejecución Directa</option>
                  </select>
                </div>
              </div>

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
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-bg text-ink-soft">Cargando…</div>;
  }
  if (!user) {
    return <Login />;
  }
  return <Dashboard />;
}

export default App
