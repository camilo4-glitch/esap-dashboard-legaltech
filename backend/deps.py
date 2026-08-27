"""
Dependencia de autenticación para FastAPI, apoyada en Supabase Auth.

Valida el JWT que el frontend envía como `Authorization: Bearer <token>`
(el mismo token de sesión que genera supabase-js al iniciar sesión) llamando
al endpoint /auth/v1/user de Supabase. No necesitamos el secreto JWT del
proyecto en el backend: basta con la URL pública + la clave anon.

Uso en un endpoint protegido:

    from fastapi import Depends
    from deps import get_current_user

    @app.post("/api/legal/upload-legal-doc")
    async def upload_legal_doc(file: UploadFile, user=Depends(get_current_user)):
        ...
"""
import os

import httpx
from fastapi import Header, HTTPException, status

SUPABASE_URL = os.environ["SUPABASE_URL"]  # ej. https://xxxx.supabase.co
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]


async def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el encabezado Authorization: Bearer <token>",
        )
    token = authorization.split(" ", 1)[1]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada. Vuelve a iniciar sesión.",
        )
    return resp.json()  # {"id": "...", "email": "...", ...}
