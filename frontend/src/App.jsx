import React, { useState, useEffect } from 'react'
import './index.css'

function App() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const [proyectos, setProyectos] = useState([]);
  const [tab, setTab] = useState('sede');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchProyectos = () => {
    fetch(`${API_URL}/api/proyectos`)
      .then(res => res.json())
      .then(data => setProyectos(data))
      .catch(err => console.error("Error fetching data: ", err));
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  // Filtrado por sede
  const filteredProyectos = proyectos.filter(p => 
    tab === 'sede' ? p.categoria === 'SEDE CENTRAL' : p.categoria && p.categoria.startsWith('TERRITORIAL')
  );

  // Stats para KPIs
  const totalValor = filteredProyectos.reduce((sum, p) => sum + (p.valor_proceso || 0), 0);
  const enEjecucion = filteredProyectos.filter(p => p.estado === 'EN EJECUCIÓN').length;
  const enTramite = filteredProyectos.length - enEjecucion;

  // Stats para Embudo
  const countFase = (faseStr) => filteredProyectos.filter(p => p.fase_actual === faseStr).length;
  const funnelData = [
    { label: 'Estructuración', count: countFase('Estructuración') },
    { label: 'Fase 1 · Anexos', count: countFase('Fase 1 · Anexos y cotización') },
    { label: 'Fase 2 · Estudios', count: countFase('Fase 2 · Estudios y pliego') },
    { label: 'Fase 3 · Adjudicación', count: countFase('Fase 3 · Evaluación y adjudicación') },
    { label: 'Ejecución', count: countFase('Ejecución (Acta de inicio)') },
  ];
  const maxFunnel = Math.max(...funnelData.map(f => f.count), 1);

  // Ranking Top 8
  const ranking = [...filteredProyectos]
    .filter(p => p.avance_documental !== undefined)
    .sort((a, b) => b.avance_documental - a.avance_documental)
    .slice(0, 8);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ 
      proyecto: '', 
      tipo_proceso: '', 
      estado: 'EN ESTRUCTURACIÓN', 
      tecnico: '', 
      valor_proceso: 0, 
      categoria: tab === 'sede' ? 'SEDE CENTRAL' : 'TERRITORIAL - GIM' 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (proyecto, e) => {
    e.stopPropagation(); // Evitar que expanda la fila
    setEditingId(proyecto.id);
    setFormData({
      proyecto: proyecto.proyecto,
      tipo_proceso: proyecto.tipo_proceso || '',
      estado: proyecto.estado,
      tecnico: proyecto.tecnico || '',
      valor_proceso: proyecto.valor_proceso || 0,
      categoria: proyecto.categoria
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'valor_proceso' ? parseFloat(value) || 0 : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const url = editingId 
      ? `${API_URL}/api/proyectos/${editingId}`
      : `${API_URL}/api/proyectos`;
      
    const method = editingId ? 'PUT' : 'POST';
    // Mantenemos el resto del proyecto si estamos editando
    const originalProject = editingId ? proyectos.find(p => p.id === editingId) : {};

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...originalProject, ...formData, id: editingId || 0 })
      });
      if (response.ok) {
        fetchProyectos();
        closeModal();
      }
    } catch (err) {
      console.error("Error saving proyecto", err);
    }
  };

  const formatMoney = (val) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return `$${val.toLocaleString('es-CO')}`;
  };

  const getStatusColor = (status) => {
    if (status === 'completado') return 'bg-teal text-teal';
    if (status === 'en_curso') return 'bg-gold text-gold';
    return 'bg-gray-light text-gray-light';
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="min-h-screen pb-16 relative bg-bg text-ink font-sans">
      {/* Topbar */}
      <div className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1360px] mx-auto px-6 py-3.5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-navy to-teal flex items-center justify-center text-white font-bold text-sm shrink-0">
              GIM
            </div>
            <div className="leading-tight">
              <div className="font-mono text-[10.5px] tracking-widest text-ink-faint uppercase font-semibold">ESAP · Gestión Corporativa</div>
              <h1 className="text-[17px] font-bold text-ink m-0">Dashboard Ejecutivo</h1>
            </div>
          </div>
          
          <div className="flex gap-1 bg-bg border border-border rounded-xl p-1">
            <button 
              className={`px-4 py-2 rounded-lg font-semibold text-[13.5px] transition-colors ${tab === 'sede' ? 'bg-navy text-white shadow' : 'text-ink-soft hover:bg-white/50'}`}
              onClick={() => setTab('sede')}
            >
              Sede Central
            </button>
            <button 
              className={`px-4 py-2 rounded-lg font-semibold text-[13.5px] transition-colors ${tab === 'territorial' ? 'bg-navy text-white shadow' : 'text-ink-soft hover:bg-white/50'}`}
              onClick={() => setTab('territorial')}
            >
              Territoriales
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1360px] mx-auto px-6 pt-7">
        <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 tracking-tight">{tab === 'sede' ? 'Sede Central CAN' : 'Direcciones Territoriales'} — Proyectos</h2>
            <p className="text-ink-soft text-sm max-w-2xl">Ruta de estructuración de los proyectos desde la fase inicial hasta el acta de inicio.</p>
          </div>
          <button 
            onClick={openAddModal}
            className="bg-teal hover:bg-teal/90 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors text-sm"
          >
            + Nuevo Proyecto
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-navy">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">Total Proyectos</div>
            <div className="text-3xl font-bold text-ink mt-1.5">{filteredProyectos.length}</div>
          </div>
          <div className="bg-card border border-border rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-teal">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">En Ejecución</div>
            <div className="text-3xl font-bold text-ink mt-1.5">{enEjecucion}</div>
          </div>
          <div className="bg-card border border-border rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gold">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">En Trámite (Precontractual)</div>
            <div className="text-3xl font-bold text-ink mt-1.5">{enTramite}</div>
          </div>
          <div className="bg-card border border-border rounded-[14px] p-4 shadow-sm relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-purple">
            <div className="font-mono text-[10.5px] tracking-widest uppercase text-ink-faint font-semibold">Valor Estimado</div>
            <div className="text-3xl font-bold text-ink mt-1.5">{formatMoney(totalValor)}</div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 items-stretch">
          
          {/* Embudo */}
          <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm flex flex-col">
            <div className="flex items-baseline justify-between mb-4 gap-2">
              <h3 className="font-bold text-[15px] m-0">Embudo precontractual</h3>
              <span className="text-[11.5px] text-ink-faint font-mono">proyectos por fase alcanzada</span>
            </div>
            <div className="flex flex-col gap-2 flex-1 justify-center">
              {funnelData.map((f, i) => (
                <div key={i} className="grid grid-cols-[120px_1fr_46px] items-center gap-3">
                  <div className="font-semibold text-[12.5px] text-ink-soft text-right">{f.label}</div>
                  <div className="bg-bg rounded-lg h-7 border border-border overflow-hidden">
                    <div className="h-full rounded-l-lg bg-gradient-to-r from-navy to-teal flex items-center transition-all duration-500" style={{ width: `${(f.count / maxFunnel) * 100}%` }}></div>
                  </div>
                  <div className="font-mono font-bold text-[13px] text-right text-ink">{f.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ranking */}
          <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm flex flex-col">
            <div className="flex items-baseline justify-between mb-4 gap-2">
              <h3 className="font-bold text-[15px] m-0">Proyectos con mayor avance</h3>
              <span className="text-[11.5px] text-ink-faint font-mono">ranking top 8</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {ranking.map((p, i) => (
                <div key={p.id} className="grid grid-cols-[22px_1fr_46px] items-center gap-2">
                  <div className="font-mono text-[11px] text-ink-faint font-bold">{i+1}</div>
                  <div className="truncate font-semibold text-[12.5px] text-ink flex items-baseline gap-1">
                    {p.proyecto} <span className="text-[10.5px] text-ink-faint font-normal">{p.tecnico}</span>
                  </div>
                  <div className="col-span-full h-1.5 bg-bg rounded overflow-hidden mt-[-4px]">
                    <div className="h-full bg-teal rounded" style={{ width: `${p.avance_documental}%` }}></div>
                  </div>
                </div>
              ))}
              {ranking.length === 0 && <div className="text-ink-faint text-sm text-center py-4">No hay datos para rankear</div>}
            </div>
          </div>

        </div>

        {/* Table Card */}
        <div className="bg-card border border-border rounded-[14px] p-5 shadow-sm flex flex-col mt-4">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-bold text-[15px] m-0">Tablero de proyectos detallado</h3>
            <span className="text-[11.5px] text-ink-faint font-mono">clic en una fila para ver detalle o en editar</span>
          </div>
          
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-[12.8px] text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border">Proyecto</th>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border">Tipo</th>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border">Etapas</th>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border">Estado</th>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border">Técnico</th>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border">Valor</th>
                  <th className="p-3 bg-bg font-semibold text-[11px] uppercase tracking-wider text-ink-soft border-b border-border"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProyectos.map(p => (
                  <React.Fragment key={p.id}>
                    <tr onClick={() => toggleRow(p.id)} className="hover:bg-bg transition-colors cursor-pointer border-b border-border last:border-0 group">
                      <td className="p-3 font-semibold text-ink group-hover:text-navy transition-colors">{p.proyecto}</td>
                      <td className="p-3">{p.tipo_proceso || '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-1 items-center">
                          {p.etapas && p.etapas.map((e, idx) => (
                            <div key={idx} className={`w-4 h-2 rounded-sm ${getStatusColor(e.status)}`} title={`${e.label}: ${e.status}`}></div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold text-white ${p.estado === 'EN EJECUCIÓN' ? 'bg-teal' : p.estado === 'EN ESTRUCTURACIÓN' ? 'bg-navy' : 'bg-gold'}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="p-3">{p.tecnico || '-'}</td>
                      <td className="p-3 font-mono font-medium">{formatMoney(p.valor_proceso)}</td>
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
                            <div>
                              <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-2">Detalle de Etapas</h4>
                              <div className="flex flex-col gap-2">
                                {p.etapas && p.etapas.map((e, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(e.status)}`}></div>
                                    <div className="text-ink font-medium">{e.label}</div>
                                    <div className="font-mono text-[9.5px] uppercase font-bold px-2 py-0.5 rounded-full bg-bg text-ink-soft">{e.status}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
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
                                  <p className="text-sm text-ink-soft">{p.abogado_contratacion || '-'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredProyectos.length === 0 && (
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
          <div className="bg-card rounded-[14px] shadow-xl w-full max-w-md border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="font-bold text-lg">{editingId ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
              <button onClick={closeModal} className="text-ink-soft hover:text-ink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Nombre del Proyecto</label>
                <input required type="text" name="proyecto" value={formData.proyecto || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Ej. Adecuación de aulas..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Tipo de Proceso</label>
                  <select name="tipo_proceso" value={formData.tipo_proceso || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="">Seleccione...</option>
                    <option value="LICITACION">Licitación</option>
                    <option value="SELECCIÓN ABREVIADA DE MENOR CUANTIA">Selección abreviada</option>
                    <option value="CONCURSO DE MÉRITOS">Concurso de méritos</option>
                    <option value="MÍNIMA CUANTÍA">Mínima cuantía</option>
                    <option value="CONTRATACIÓN DIRECTA">Contratación directa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Estado</label>
                  <select name="estado" value={formData.estado || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                    <option value="EN ESTRUCTURACIÓN">Estructuración</option>
                    <option value="EN CURSO">En curso</option>
                    <option value="ADJUDICADO">Adjudicado</option>
                    <option value="EN EJECUCIÓN">En Ejecución</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Técnico a cargo</label>
                  <input required type="text" name="tecnico" value={formData.tecnico || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Valor Estimado</label>
                  <input required type="number" name="valor_proceso" value={formData.valor_proceso || 0} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white" placeholder="Ej. 150000000" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1 uppercase tracking-wide">Categoría / Sede</label>
                <select name="categoria" value={formData.categoria || ''} onChange={handleInputChange} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
                  <option value="SEDE CENTRAL">Sede Central</option>
                  <option value="TERRITORIAL - GIM">Territorial GIM</option>
                  <option value="TERRITORIAL - EJECUCION DIRECTA">Ejecución Directa</option>
                </select>
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

export default App
