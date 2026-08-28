import { useEffect, useRef, useState } from 'react'
import { listSedes } from '../lib/sedesApi'

// Leaflet se carga desde CDN al montar el componente, no como dependencia del
// proyecto: así el despliegue no cambia y no hay que tocar package.json.
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
    js.addEventListener('error', () => reject(new Error('No se pudo cargar el mapa')))
    if (window.L) resolve(window.L)
  })
}

const COLOR_TIPO = {
  central:     '#B08D3F',   // dorado institucional
  territorial: '#132242',   // azul carbón
  cetap:       '#1A7A6E',   // verde azulado
}
const ETIQUETA_TIPO = { central: 'Sede Central', territorial: 'Dirección Territorial', cetap: 'CETAP' }

export default function MapaSedes() {
  const contenedor = useRef(null)
  const mapa = useRef(null)
  const [sedes, setSedes] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('')

  useEffect(() => {
    listSedes()
      .then(setSedes)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  const visibles = sedes.filter(s => !filtroTipo || s.tipo === filtroTipo)

  useEffect(() => {
    if (cargando || error || !contenedor.current) return
    let cancelado = false

    cargarLeaflet().then(L => {
      if (cancelado) return

      if (!mapa.current) {
        mapa.current = L.map(contenedor.current, { scrollWheelZoom: false })
          .setView([4.6, -74.1], 5)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 18,
        }).addTo(mapa.current)
        // La rueda del ratón solo hace zoom si el mapa tiene el foco, para no
        // secuestrar el desplazamiento de la página.
        mapa.current.on('focus', () => mapa.current.scrollWheelZoom.enable())
        mapa.current.on('blur', () => mapa.current.scrollWheelZoom.disable())
      }

      // Limpia marcadores anteriores
      mapa.current.eachLayer(capa => {
        if (capa instanceof L.CircleMarker) mapa.current.removeLayer(capa)
      })

      const puntos = []
      visibles.forEach(s => {
        if (s.lat == null || s.lng == null) return
        const n = s.proyectos ?? 0
        const radio = 7 + Math.min(n, 20) * 0.9
        const marcador = L.circleMarker([Number(s.lat), Number(s.lng)], {
          radius: radio,
          color: '#fff',
          weight: 2,
          fillColor: COLOR_TIPO[s.tipo] || '#8892a6',
          fillOpacity: 0.85,
        }).addTo(mapa.current)

        marcador.bindTooltip(
          `<b>${s.nombre}</b><br>${s.municipio || ''}${n ? ` · ${n} proyecto${n === 1 ? '' : 's'}` : ' · sin proyectos'}`,
          { direction: 'top' }
        )
        marcador.on('click', () => setSeleccionada(s))
        puntos.push([Number(s.lat), Number(s.lng)])
      })

      if (puntos.length > 0) {
        mapa.current.fitBounds(puntos, { padding: [40, 40], maxZoom: 7 })
      }
    }).catch(e => setError(e.message))

    return () => { cancelado = true }
  }, [cargando, error, sedes, filtroTipo])

  const conteo = (tipo) => sedes.filter(s => s.tipo === tipo).length
  const totalProyectos = visibles.reduce((a, s) => a + (s.proyectos ?? 0), 0)
  const sinCoordenadas = sedes.filter(s => s.lat == null || s.lng == null).length

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
          <h3 className="font-serif text-[16px] font-semibold text-navy-deep m-0">Mapa de intervenciones</h3>
          <span className="text-[11.5px] text-ink-faint font-mono">
            {visibles.length} sedes · {totalProyectos} proyectos
          </span>
        </div>
        <p className="text-[12px] text-ink-soft mb-4">
          El tamaño del punto refleja cuántos proyectos hay en esa sede. Haz clic para ver el detalle.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { v: '', t: `Todas (${sedes.length})` },
            { v: 'central', t: `Sede Central (${conteo('central')})` },
            { v: 'territorial', t: `Territoriales (${conteo('territorial')})` },
            { v: 'cetap', t: `CETAP (${conteo('cetap')})` },
          ].map(op => (
            <button
              key={op.v}
              onClick={() => setFiltroTipo(op.v)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                filtroTipo === op.v
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-ink-soft border-border hover:border-navy'
              }`}
            >
              {op.t}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[13px]">
            No se pudo cargar el mapa ({error}). El listado de sedes de abajo sigue disponible.
          </div>
        )}

        <div
          ref={contenedor}
          tabIndex={0}
          className="w-full h-[460px] rounded-lg border border-border bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        />

        <div className="flex flex-wrap gap-4 mt-3 text-[11.5px] text-ink-soft">
          {Object.entries(ETIQUETA_TIPO).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_TIPO[k] }}></span>{v}
            </span>
          ))}
          {sinCoordenadas > 0 && (
            <span className="text-ink-faint">· {sinCoordenadas} sede(s) sin coordenadas, no aparecen en el mapa</span>
          )}
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

          {!seleccionada.verificado && (
            <p className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-3">
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
            {seleccionada.telefono && (
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-ink-faint font-bold">Teléfono</dt>
                <dd className="text-ink-soft m-0">{seleccionada.telefono}</dd>
              </div>
            )}
            {seleccionada.correo && (
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-ink-faint font-bold">Correo</dt>
                <dd className="text-ink-soft m-0">{seleccionada.correo}</dd>
              </div>
            )}
          </dl>

          <h4 className="font-bold text-[10.5px] uppercase tracking-widest text-ink-faint mb-2">
            Proyectos en esta sede ({seleccionada.listaProyectos?.length || 0})
          </h4>
          {seleccionada.listaProyectos?.length ? (
            <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
              {seleccionada.listaProyectos.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-[13px] border-b border-border pb-1.5 last:border-0">
                  <span className="text-ink font-medium truncate">{p.nombre}</span>
                  <span className="text-[11px] text-ink-soft font-mono shrink-0">{p.status_actual || '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-faint">Sin proyectos registrados en esta sede.</p>
          )}
        </div>
      )}
    </div>
  )
}
