import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const BUCKET = 'documentos-proyectos'

// Construye el enlace a SECOP II:
// - Si el proyecto ya tiene un link completo guardado en `secop`, lo usa tal cual.
// - Si solo tiene `numeroSecop`, arma un enlace de búsqueda pública en SECOP II.
function buildSecopUrl(proyecto) {
  if (proyecto.secop) return proyecto.secop
  if (proyecto.numeroSecop) {
    return `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${encodeURIComponent(
      proyecto.numeroSecop
    )}`
  }
  return null
}

// Panel para insertar dentro del modal/detalle de un proyecto existente.
// Props: proyecto (objeto ya mapeado por proyectosApi.fromRow), onProyectoChange (opcional)
export default function DocumentosPanel({ proyecto, onSaved }) {
  const [numeroSecop, setNumeroSecop] = useState(proyecto.numeroSecop || '')
  const [secopUrl, setSecopUrl] = useState(proyecto.secop || '')
  const [rutaDocumentos, setRutaDocumentos] = useState(proyecto.rutaDocumentos || '')
  const [archivos, setArchivos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [fase, setFase] = useState('precontractual')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarArchivos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  async function cargarArchivos() {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('proyecto_id', proyecto.id)
      .order('created_at', { ascending: false })
    if (!error) setArchivos(data)
  }

  async function guardarEnlaces() {
    const { error } = await supabase
      .from('proyectos')
      .update({
        numero_secop: numeroSecop || null,
        secop: secopUrl || null,
        ruta_documentos: rutaDocumentos || null,
      })
      .eq('id', proyecto.id)
    if (error) {
      setMensaje('No se pudo guardar: ' + error.message)
      return
    }
    setMensaje('Enlaces guardados.')
    onSaved?.()
  }

  async function subirArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    setMensaje('')
    try {
      const path = `${proyecto.id}/${fase}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
      })
      if (upErr) throw upErr

      const { data: { user } } = await supabase.auth.getUser()
      const { error: dbErr } = await supabase.from('documentos').insert({
        proyecto_id: proyecto.id,
        fase,
        nombre_archivo: file.name,
        storage_path: path,
        content_type: file.type,
        size_bytes: file.size,
        subido_por: user?.id ?? null,
      })
      if (dbErr) throw dbErr

      await cargarArchivos()
      setMensaje('Documento cargado correctamente.')
    } catch (err) {
      setMensaje('Error al subir: ' + err.message)
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  async function descargar(doc) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60) // enlace válido 60s
    if (error) {
      setMensaje('No se pudo generar el enlace: ' + error.message)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function eliminar(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"? Esta acción no se puede deshacer.`)) return
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
    await supabase.from('documentos').delete().eq('id', doc.id)
    await cargarArchivos()
  }

  const secopLinkActual = buildSecopUrl(proyecto)

  return (
    <div style={s.wrap}>
      <h3 style={s.h3}>SECOP y carpeta del proceso</h3>
      <div style={s.row}>
        <div style={s.col}>
          <label style={s.label}>Número de proceso SECOP</label>
          <input
            style={s.input}
            value={numeroSecop}
            onChange={(e) => setNumeroSecop(e.target.value)}
            placeholder="Ej. ESAP-SAMC-012-2026"
          />
        </div>
        <div style={s.col}>
          <label style={s.label}>Enlace directo a SECOP (opcional)</label>
          <input
            style={s.input}
            value={secopUrl}
            onChange={(e) => setSecopUrl(e.target.value)}
            placeholder="https://community.secop.gov.co/..."
          />
        </div>
      </div>
      <div style={s.row}>
        <div style={s.col}>
          <label style={s.label}>Carpeta del proceso (Drive)</label>
          <input
            style={s.input}
            value={rutaDocumentos}
            onChange={(e) => setRutaDocumentos(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
          />
        </div>
      </div>
      <div style={s.linksRow}>
        {secopLinkActual && (
          <a href={secopLinkActual} target="_blank" rel="noopener noreferrer" style={s.link}>
            🔗 Ver en SECOP II
          </a>
        )}
        {proyecto.rutaDocumentos && (
          <a href={proyecto.rutaDocumentos} target="_blank" rel="noopener noreferrer" style={s.link}>
            📁 Abrir carpeta del proceso
          </a>
        )}
        <button style={s.buttonSecondary} onClick={guardarEnlaces}>
          Guardar enlaces
        </button>
      </div>

      <h3 style={s.h3}>Documentos del proceso</h3>
      <div style={s.uploadRow}>
        <select style={s.select} value={fase} onChange={(e) => setFase(e.target.value)}>
          <option value="precontractual">Precontractual</option>
          <option value="contractual">Contractual</option>
          <option value="poscontractual">Poscontractual</option>
        </select>
        <label style={s.uploadButton}>
          {subiendo ? 'Subiendo…' : '⬆ Cargar documento'}
          <input type="file" onChange={subirArchivo} disabled={subiendo} style={{ display: 'none' }} />
        </label>
      </div>

      {mensaje && <p style={s.mensaje}>{mensaje}</p>}

      <ul style={s.list}>
        {archivos.length === 0 && <li style={s.empty}>Aún no hay documentos cargados.</li>}
        {archivos.map((doc) => (
          <li key={doc.id} style={s.item}>
            <span style={s.itemFase}>{doc.fase}</span>
            <span style={s.itemNombre}>{doc.nombre_archivo}</span>
            <span style={s.itemFecha}>
              {new Date(doc.created_at).toLocaleDateString('es-CO')}
            </span>
            <button style={s.smallButton} onClick={() => descargar(doc)}>
              Descargar
            </button>
            <button style={s.smallButtonDanger} onClick={() => eliminar(doc)}>
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const s = {
  wrap: { padding: '16px 0' },
  h3: { fontSize: 14, color: '#132242', margin: '16px 0 8px' },
  row: { display: 'flex', gap: 12, marginBottom: 8 },
  col: { flex: 1 },
  label: { display: 'block', fontSize: 12, color: '#5B6478', marginBottom: 4 },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #E2E6EE',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  select: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #E2E6EE',
    fontSize: 13,
  },
  linksRow: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  link: { fontSize: 13, color: '#1A7A6E', textDecoration: 'none', fontWeight: 600 },
  buttonSecondary: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #132242',
    background: '#fff',
    color: '#132242',
    fontSize: 12,
    cursor: 'pointer',
  },
  uploadRow: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 },
  uploadButton: {
    padding: '8px 14px',
    borderRadius: 6,
    background: '#132242',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
  },
  mensaje: { fontSize: 12, color: '#1A7A6E', marginTop: 8 },
  list: { listStyle: 'none', padding: 0, marginTop: 12 },
  empty: { fontSize: 12, color: '#8A93A6' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid #eef1f8',
    fontSize: 12,
  },
  itemFase: {
    background: '#EEF1F6',
    color: '#132242',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  itemNombre: { flex: 1 },
  itemFecha: { color: '#8A93A6' },
  smallButton: {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #E2E6EE',
    background: '#fff',
    fontSize: 11,
    cursor: 'pointer',
  },
  smallButtonDanger: {
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid #e0b4b0',
    background: '#fff',
    color: '#b3261e',
    fontSize: 11,
    cursor: 'pointer',
  },
}
