import { useEffect, useRef, useState, useMemo } from 'react'
import { listSedes, listVinculos, listProyectosPorDepartamento } from '../lib/sedesApi'

// Cartografía oficial de departamentos, cargada en tiempo de ejecución para no
// inflar el proyecto. La propiedad con el nombre es NOMBRE_DPT, en mayúsculas
// y sin tildes, así que hay que normalizar antes de cruzar.
const GEO_DEPTOS = 'https://raw.githubusercontent.com/santiblanko/colombia.geojson/master/depto.json'

const sinTildes = (t) => (t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().trim()

// Nombres que no coinciden literalmente entre nuestra base y la cartografía.
const ALIAS_DEPTO = {
  'BOGOTA D.C.': 'SANTAFE DE BOGOTA D.C',
  'SAN ANDRES Y PROVIDENCIA': 'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA',
}
const claveDepto = (nombre) => {
  const n = sinTildes(nombre)
  return ALIAS_DEPTO[n] || n
}

// Rampa secuencial de un solo tono, de claro a oscuro. Nunca arcoíris:
// la variable es una magnitud, no categorías.
const RAMPA = ['#EEF1F6', '#C5D0E4', '#8EA3C9', '#4A6BA5', '#16233F']
const escalon = (n) => n === 0 ? 0 : n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
const ETIQUETA_ESCALON = ['Sin proyectos', '1', '2 a 4', '5 a 9', '10 o más']

// Leaflet se carga desde CDN al montar: así el despliegue no cambia y no hay
// que tocar package.json.
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
const LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'

function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L)
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'; css.href = LEAFLET_CSS
      document.head.appendChild(css)
    }
    let js = document.querySelector(`script[src="${LEAFLET_JS}"]`)
    if (!js) {
      js = document.createElement('script')
      js.src = LEAFLET_JS; js.async = true
      document.head.appendChild(js)
    }
    js.addEventListener('load', () => resolve(window.L))
    js.addEventListener('error', () => reject(new Error('no se pudo cargar la librería del mapa')))
    if (window.L) resolve(window.L)
  })
}

const COLOR_TIPO = { central: '#B08D3F', territorial: '#132242', cetap: '#1A7A6E' }
const ETIQUETA_TIPO = { central: 'Sede Central', territorial: 'Dirección Territorial', cetap: 'CETAP' }
const COLOR_SEMAFORO = { vencido: '#e34948', por_vencer: '#eda100', en_termino: '#1baf7a', sin_termino: '#c3cad6' }

const FASES = {
  necesidad: 'Necesidad (PAA)', estructuracion: 'Estructuración',
  radicado: 'Radicado y en revisión', seleccion: 'Selección publicada',
  adjudicacion: 'Adjudicación', perfeccionamiento: 'Perfeccionamiento',
  ejecucion: 'En ejecución', liquidacion: 'Liquidación', cerrado: 'Cerrado',
}

export default function MapaSedes({ proyectos = [], presentacion = false }) {
  const contenedor = useRef(null)
  const mapa = useRef(null)
  const capas = useRef([])
  const [sedes, setSedes] = useState([])
  const [vinculos, setVinculos] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState(null)

  // Filtros del mapa
  const [fTipo, setFTipo] = useState('')
  const [fFase, setFFase] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [soloVencidos, setSoloVencidos] = useState(false)

  // Vista del mapa: puntos por sede o intensidad por departamento
  const [vista, setVista] = useState('puntos')
  const [porDepto, setPorDepto] = useState([])
  const [geo, setGeo] = useState(null)
  const [avisoGeo, setAvisoGeo] = useState('')

  useEffect(() => {
    Promise.all([listSedes(), listVinculos(), listProyectosPorDepartamento()])
      .then(([s, v, d]) => { setSedes(s); setVinculos(v); setPorDepto(d) })
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  // La cartografía se descarga solo si el usuario pide esa vista.
  useEffect(() => {
    if (vista !== 'departamentos' || geo) return
    fetch(GEO_DEPTOS)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(setGeo)
      .catch(() => setAvisoGeo('No se pudo descargar la cartografía de departamentos. Se mantiene la vista de puntos.'))
  }, [vista, geo])

  const porId = useMemo(() => Object.fromEntries(proyectos.map(p => [p.id, p])), [proyectos])

  // Proyectos que sobreviven a los filtros
  const proyectosFiltrados = useMemo(() => proyectos.filter(p =>
    (!fFase   || p.fase === fFase) &&
    (!fEstado || p.statusActual === fEstado) &&
    (!soloVencidos || p.semaforo === 'vencido')
  ), [proyectos, fFase, fEstado, soloVencidos])

  const idsVisibles = useMemo(() => new Set(proyectosFiltrados.map(p => p.id)), [proyectosFiltrados])

  // Sedes con sus proyectos ya filtrados
  const sedesConDatos = useMemo(() => {
    const agrupado = {}
    for (const v of vinculos) {
      if (!idsVisibles.has(v.proyecto_id)) continue
      const p = porId[v.proyecto_id]
      if (p) (agrupado[v.sede_id] ||= []).push(p)
    }
    return sedes
      .filter(s => !fTipo || s.tipo === fTipo)
      .map(s => ({ ...s, lista: agrupado[s.id] || [] }))
  }, [sedes, vinculos, idsVisibles, porId, fTipo])

  const hayFiltros = !!(fTipo || fFase || fEstado || soloVencidos)
  const limpiar = () => { setFTipo(''); setFFase(''); setFEstado(''); setSoloVencidos(false) }

  const opcionesEstado = useMemo(
    () => [...new Set(proyectos.map(p => p.statusActual).filter(Boolean))].sort(), [proyectos])

  // Cobertura: cuántos proyectos tienen ubicación registrada
  const ubicados = useMemo(() => new Set(vinculos.map(v => v.proyecto_id)).size, [vinculos])
  const totalProyectos = proyectos.length

  useEffect(() => {
    if (cargando || !contenedor.current) return
    let cancelado = false

    cargarLeaflet().then(L => {
      if (cancelado) return
      if (!mapa.current) {
        mapa.current = L.map(contenedor.current, { scrollWheelZoom: false, attributionControl: !presentacion })
          .setView([4.6, -74.1], 5)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap', maxZoom: 18,
        }).addTo(mapa.current)
        mapa.current.on('focus', () => mapa.current.scrollWheelZoom.enable())
        mapa.current.on('blur', () => mapa.current.scrollWheelZoom.disable())
      }

      capas.current.forEach(c => mapa.current.removeLayer(c))
      capas.current = []

      // --- Capa de departamentos (coroplética) ---
      if (vista === 'departamentos' && geo) {
        const conteo = {}
        for (const d of porDepto) conteo[claveDepto(d.departamento)] = d
        const capa = L.geoJSON(geo, {
          style: (f) => {
            const d = conteo[sinTildes(f.properties?.NOMBRE_DPT)]
            return {
              fillColor: RAMPA[escalon(d?.proyectos || 0)],
              fillOpacity: 0.85, color: '#ffffff', weight: 1,
            }
          },
          onEachFeature: (f, capaDepto) => {
            const nombre = f.properties?.NOMBRE_DPT || 'Departamento'
            const d = conteo[sinTildes(nombre)]
            const n = d?.proyectos || 0
            capaDepto.bindTooltip(
              `<b>${nombre}</b><br>${n} proyecto${n === 1 ? '' : 's'}` +
              (d?.vencidos ? `<br><b style="color:#b3261e">${d.vencidos} vencido(s)</b>` : ''),
              { sticky: true })
            capaDepto.on('mouseover', () => capaDepto.setStyle({ weight: 2.5, color: '#B08D3F' }))
            capaDepto.on('mouseout',  () => capaDepto.setStyle({ weight: 1, color: '#ffffff' }))
          },
        }).addTo(mapa.current)
        capas.current.push(capa)
        mapa.current.fitBounds(capa.getBounds(), { padding: [20, 20] })
      }

      const puntos = []
      sedesConDatos.forEach(s => {
        if (s.lat == null || s.lng == null) return
        const n = s.lista.length
        const vencidosAqui = s.lista.filter(p => p.semaforo === 'vencido').length
        // Sin proyectos tras el filtro: punto tenue, para no perder la referencia geográfica
        const radio = vista === 'departamentos'
          ? (n === 0 ? 3 : 5)
          : (n === 0 ? 5 : 7 + Math.min(n, 20) * 0.9)
        const relleno = vencidosAqui > 0 ? COLOR_SEMAFORO.vencido : (COLOR_TIPO[s.tipo] || '#8892a6')

        const m = L.circleMarker([Number(s.lat), Number(s.lng)], {
          radius: radio, color: '#fff', weight: 2,
          fillColor: relleno, fillOpacity: n === 0 ? 0.25 : 0.85,
        }).addTo(mapa.current)

        m.bindTooltip(
          `<b>${s.nombre}</b><br>${s.municipio || ''}` +
          (n ? ` · ${n} proyecto${n === 1 ? '' : 's'}` : ' · sin proyectos') +
          (vencidosAqui ? `<br><b style="color:#b3261e">${vencidosAqui} vencido${vencidosAqui === 1 ? '' : 's'}</b>` : ''),
          { direction: 'top' })
        m.on('click', () => setSeleccionada(s))
        capas.current.push(m)
        if (n > 0) puntos.push([Number(s.lat), Number(s.lng)])
      })

      if (vista === 'puntos' && puntos.length > 0) {
        mapa.current.fitBounds(puntos, { padding: [40, 40], maxZoom: 7 })
      }
      setTimeout(() => mapa.current?.invalidateSize(), 60)
    }).catch(e => setError(e.message))

    return () => { cancelado = true }
  }, [cargando, sedesConDatos, presentacion, vista, geo, porDepto])

  // Al entrar o salir de presentación el contenedor cambia de tamaño
  useEffect(() => { setTimeout(() => mapa.current?.invalidateSize(), 250) }, [presentacion])

  const conteoTipo = (t) => sedes.filter(s => s.tipo === t).length
  const proyectosEnMapa = sedesConDatos.reduce((a, s) => a + s.lista.length, 0)
  const sinCoordenadas = sedes.filter(s => s.lat == null || s.lng == null).length

  const selectCls = 'border border-border rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-teal'

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
          <h3 className={`font-serif font-semibold text-navy-deep m-0 ${presentacion ? 'text-[24px]' : 'text-[16px]'}`}>
            Mapa de intervenciones
          </h3>
          <span className={`text-ink-faint font-mono ${presentacion ? 'text-[13px]' : 'text-[11.5px]'}`}>
            {proyectosEnMapa} proyecto{proyectosEnMapa === 1 ? '' : 's'} en {sedesConDatos.filter(s => s.lista.length).length} sede{sedesConDatos.filter(s => s.lista.length).length === 1 ? '' : 's'}
          </span>
        </div>

        {!presentacion && (
          <p className="text-[12px] text-ink-soft mb-4">
            El tamaño del punto refleja cuántos proyectos hay en esa sede; se pinta en rojo si alguno está vencido.
            Haz clic para ver el detalle.
          </p>
        )}

        {avisoGeo && (
          <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">{avisoGeo}</p>
        )}

        {/* Una sola barra: vista + filtros. Antes eran dos filas separadas
            y se leían como dos sistemas de filtrado distintos. */}
        <div className="no-presentar flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex rounded-lg border border-border overflow-hidden mr-1">
            {[['puntos','Por sede'], ['departamentos','Por departamento']].map(([k, t]) => (
              <button key={k} type="button" onClick={() => setVista(k)}
                className={`px-3 py-1.5 text-[12px] font-semibold border-0 cursor-pointer transition-colors ${
                  vista === k ? 'bg-navy text-white' : 'bg-white text-ink-soft hover:text-navy'}`}>
                {t}
              </button>
            ))}
          </div>
          {vista === 'departamentos' && !geo && !avisoGeo && (
            <span className="text-[11.5px] text-ink-faint">Descargando cartografía…</span>
          )}
          <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={selectCls}>
            <option value="">Todas las sedes ({sedes.length})</option>
            <option value="central">Sede Central ({conteoTipo('central')})</option>
            <option value="territorial">Territoriales ({conteoTipo('territorial')})</option>
            <option value="cetap">CETAP ({conteoTipo('cetap')})</option>
          </select>
          <select value={fFase} onChange={e => setFFase(e.target.value)} className={selectCls}>
            <option value="">Fase: todas</option>
            {Object.entries(FASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} className={selectCls}>
            <option value="">Estado: todos</option>
            {opcionesEstado.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <label className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border cursor-pointer select-none ${
            soloVencidos ? 'bg-red-50 border-red-200 text-red-700 font-semibold' : 'bg-white border-border text-ink-soft'}`}>
            <input type="checkbox" checked={soloVencidos} onChange={e => setSoloVencidos(e.target.checked)} className="w-3.5 h-3.5 accent-red-600" />
            Solo vencidos
          </label>
          {hayFiltros && (
            <button onClick={limpiar} className="text-[12px] text-navy hover:text-navy-deep underline bg-transparent border-0 cursor-pointer font-semibold">
              Limpiar
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[13px] mb-3">
            No se pudo cargar el mapa ({error}). El listado de sedes sigue disponible abajo.
          </div>
        )}

        <div ref={contenedor} tabIndex={0}
             className={`w-full rounded-lg border border-border bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
               presentacion ? 'h-[68vh]' : 'h-[460px]'}`} />

        {vista === 'departamentos' && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-widest text-ink-faint font-bold">Proyectos</span>
            <span className="flex items-center gap-0">
              {RAMPA.map((c, i) => (
                <span key={i} className="flex flex-col items-center">
                  <span className="w-11 h-3.5 block" style={{ background: c }}></span>
                  <span className="text-[9.5px] text-ink-faint font-mono mt-0.5">{ETIQUETA_ESCALON[i]}</span>
                </span>
              ))}
            </span>
            <span className="text-[11px] text-ink-faint">
              El conteo usa la jurisdicción de cada territorial, no solo su ciudad sede.
            </span>
          </div>
        )}

        <div className={`flex flex-wrap gap-4 mt-3 text-ink-soft ${presentacion ? 'text-[13px]' : 'text-[11.5px]'}`}>
          {Object.entries(ETIQUETA_TIPO).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_TIPO[k] }}></span>{v}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_SEMAFORO.vencido }}></span>Con proceso vencido
          </span>
          {/* Declarar la cobertura protege: es peor que un tercero descubra solo que faltan proyectos */}
          <span className="ml-auto font-mono text-ink-faint">
            {ubicados} de {totalProyectos} proyectos ubicados
            {sinCoordenadas > 0 && ` · ${sinCoordenadas} sede(s) sin coordenadas`}
          </span>
        </div>
      </div>

      {seleccionada && (
        <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-serif text-[17px] font-semibold text-navy-deep m-0">{seleccionada.nombre}</h3>
              <p className="text-[12px] text-ink-soft mt-0.5">
                {ETIQUETA_TIPO[seleccionada.tipo]}
                {seleccionada.municipio ? ` · ${seleccionada.municipio}` : ''}
                {seleccionada.departamento ? `, ${seleccionada.departamento}` : ''}
              </p>
            </div>
            <button onClick={() => setSeleccionada(null)} className="text-ink-faint hover:text-navy bg-transparent border-0 cursor-pointer text-sm">
              Cerrar
            </button>
          </div>

          {!seleccionada.verificado && !presentacion && (
            <p className="no-presentar text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3">
              Ciudad y ubicación pendientes de confirmar contra el acto administrativo.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] mb-4">
            {seleccionada.jurisdiccion && (
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-widest text-ink-faint font-bold">Jurisdicción</dt>
                <dd className="text-ink-soft m-0">{seleccionada.jurisdiccion}</dd>
              </div>
            )}
            {seleccionada.direccion && (
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-widest text-ink-faint font-bold">Dirección</dt>
                <dd className="text-ink-soft m-0">{seleccionada.direccion}</dd>
              </div>
            )}
          </dl>

          <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-2">
            Proyectos {hayFiltros && 'que coinciden con el filtro '}({seleccionada.lista?.length || 0})
          </h4>
          {seleccionada.lista?.length ? (
            <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
              {seleccionada.lista.map(p => (
                <li key={p.id} className="flex items-center gap-2.5 text-[13px] border-b border-border pb-1.5 last:border-0">
                  <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: COLOR_SEMAFORO[p.semaforo] || COLOR_SEMAFORO.sin_termino }}></span>
                  <span className="text-ink font-medium truncate flex-1">{p.nombre}</span>
                  <span className="text-[11px] text-ink-soft font-mono shrink-0">{FASES[p.fase] || '—'}</span>
                  <span className="text-[11px] font-mono font-semibold text-navy-deep shrink-0 w-9 text-right">
                    {p.avanceVigente ?? p.avance ?? 0}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-faint">
              {hayFiltros ? 'Ningún proyecto de esta sede coincide con el filtro.' : 'Sin proyectos registrados en esta sede.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
