"""
main.py endurecido — reemplaza al que dejó Antigravity.

Cambios frente a la versión anterior:
1. CORS ya no acepta "*": solo los orígenes listados en ALLOWED_ORIGINS (env var).
2. El CRUD de /api/proyectos (sin autenticación, en memoria) se elimina de aquí.
   El frontend ahora habla directamente con Supabase (frontend/src/lib/proyectosApi.js),
   que ya exige sesión autenticada por las políticas RLS aplicadas en el proyecto.
3. Los endpoints del asistente legal (RAG) quedan protegidos con get_current_user:
   solo un usuario con sesión válida en Supabase puede subir documentos o preguntar.
4. La API key de Gemini se lee SOLO de una variable de entorno del servidor
   (nunca se recibe desde el cliente/query param).

Variables de entorno esperadas en Render:
  SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY, ALLOWED_ORIGINS
  (ALLOWED_ORIGINS separadas por coma, ej: "https://tu-app.vercel.app,http://localhost:5173")
"""
import os

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from deps import get_current_user

app = FastAPI(title="ESAP-LegalTech API")

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
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(500, "GEMINI_API_KEY no está configurada en el servidor.")
    # TODO: reintegrar aquí la llamada a rag_core.responder(texto, gemini_key)
    return {"respuesta": "(placeholder) Aquí responde el Asistente Jurídico configurado en rag_core.py"}
