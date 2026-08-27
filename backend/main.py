"""
main.py endurecido — reemplaza al que dejó Antigravity.

Cambios frente a la versión anterior:
1. CORS ya no acepta "*": solo los orígenes listados en ALLOWED_ORIGINS (env var).
2. El CRUD de /api/proyectos (sin autenticación, en memoria) se elimina de aquí.
   El frontend ahora habla directamente con Supabase (frontend/src/lib/proyectosApi.js),
   que ya exige sesión autenticada por las políticas RLS aplicadas en el proyecto.
3. Los endpoints del asistente legal (RAG) quedan protegidos con get_current_user:
   solo un usuario con sesión válida en Supabase puede subir documentos o preguntar.
4. El proveedor de IA es DeepSeek (no Gemini). Su API es compatible con el SDK de
   OpenAI, así que se usa el paquete `openai` apuntando a https://api.deepseek.com.
   Modelo: "deepseek-chat" (DeepSeek-V3.2, uso general — bueno para resumir/citar
   sobre los documentos ya recuperados). Si en algún momento se necesita más
   razonamiento paso a paso sobre un caso complejo, existe también
   "deepseek-reasoner" — se puede exponer como parámetro más adelante.
   La clave se lee SOLO de una variable de entorno del servidor
   (nunca se recibe desde el cliente/query param).

Variables de entorno esperadas en Render:
  SUPABASE_URL, SUPABASE_ANON_KEY, DEEPSEEK_API_KEY, ALLOWED_ORIGINS
  (ALLOWED_ORIGINS separadas por coma, ej: "https://tu-app.vercel.app,http://localhost:5173")
"""
import os

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

from deps import get_current_user

app = FastAPI(title="ESAP-LegalTech API")

_deepseek_client = None


def get_deepseek_client() -> OpenAI:
    """Cliente perezoso: solo se crea la primera vez que se necesita, y falla
    con un mensaje claro si falta la clave, en vez de tumbar el arranque del server."""
    global _deepseek_client
    if _deepseek_client is None:
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            raise HTTPException(500, "DEEPSEEK_API_KEY no está configurada en el servidor.")
        _deepseek_client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    return _deepseek_client

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Asistente Legal (RAG) — protegido: requiere sesión válida de Supabase.
# Conserva aquí la lógica que ya tenías en rag_core.py; lo único que cambia
# es que ahora cada endpoint exige `user=Depends(get_current_user)`.
# ---------------------------------------------------------------------------

@app.post("/api/legal/upload-legal-doc")
async def upload_legal_doc(file: UploadFile, user=Depends(get_current_user)):
    # TODO: reintegrar aquí la llamada a rag_core.procesar_pdf(file)
    # que ya tenías funcionando localmente.
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se aceptan archivos PDF.")
    contenido = await file.read()
    # rag_core.indexar(contenido, nombre=file.filename, usuario=user["id"])
    return {"status": "recibido", "archivo": file.filename, "bytes": len(contenido)}


@app.post("/api/legal/chat")
async def chat(pregunta: dict, user=Depends(get_current_user)):
    texto = pregunta.get("mensaje", "")
    if not texto:
        raise HTTPException(400, "Falta el campo 'mensaje'.")

    client = get_deepseek_client()
    # TODO: antes de este paso, recuperar aquí los fragmentos relevantes de los
    # documentos ya indexados (la parte "R" de RAG) y agregarlos como contexto
    # al mensaje "system" de abajo — eso es lo que faltaba de rag_core.py.
    try:
        respuesta = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres el Asistente Jurídico del GIM (Gestión de Infraestructura "
                        "Misional) de la ESAP. Respondes con precisión sobre contratación "
                        "estatal colombiana (Ley 80/1993, SECOP II) y sobre los procesos "
                        "de infraestructura del equipo. Si no tienes información suficiente "
                        "para responder con certeza, dilo explícitamente en vez de inventar."
                    ),
                },
                {"role": "user", "content": texto},
            ],
            temperature=0.2,
        )
    except Exception as exc:  # noqa: BLE001 — se traduce a un 502 legible para el frontend
        raise HTTPException(502, f"Error consultando DeepSeek: {exc}") from exc

    return {"respuesta": respuesta.choices[0].message.content}
