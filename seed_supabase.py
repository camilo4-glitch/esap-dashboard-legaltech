"""
Siembra los 59 proyectos reales en Supabase.

EJECUTAR SOLO EN TU COMPUTADOR (no lo corras en Render ni lo compartas):
usa la SERVICE ROLE KEY, que tiene permisos totales y nunca debe salir de tu máquina
ni quedar commiteada en Git.

Uso:
  1. pip install supabase
  2. Copia tu archivo raw-data.json real a la misma carpeta que este script
     (el mismo que ya tenías en BACKEND PROCESOS GIM/backend/raw-data.json).
  3. Define las variables de entorno (o pégalas directo, solo en tu máquina):
       set SUPABASE_URL=https://calppiprmvtbgtindhuv.supabase.co      (Windows)
       set SUPABASE_SERVICE_ROLE_KEY=<la copias del panel de Supabase>
  4. python seed_supabase.py
"""
import json
import os
import sys

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://calppiprmvtbgtindhuv.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    sys.exit(
        "Falta SUPABASE_SERVICE_ROLE_KEY. Cópiala desde "
        "Supabase > Project Settings > API > service_role (secret) y expórtala "
        "como variable de entorno antes de correr este script."
    )

RAW_DATA_PATH = os.path.join(os.path.dirname(__file__), "raw-data.json")

FIELD_MAP = {
    "id": "id",
    "nombre": "nombre",
    "sede": "sede",
    "tipo": "tipo",
    "objeto": "objeto",
    "abogado": "abogado",
    "cdp": "cdp",
    "valorContrato": "valor_contrato",
    "tecnico": "tecnico",
    "juridico": "juridico",
    "financiero": "financiero",
    "apoyoSupervision": "apoyo_supervision",
    "supervisor": "supervisor",
    "contratista": "contratista",
    "fase": "fase",
    "fasePrec": "fase_prec",
    "faseCont": "fase_cont",
    "fasePos": "fase_pos",
    "avance": "avance",
    "avanceContractual": "avance_contractual",
    "avancePoscontractual": "avance_poscontractual",
    "adjudicado": "adjudicado",
    "statusActual": "status_actual",
    "observaciones": "observaciones",
    "docsF1": "docs_f1",
    "docsF2": "docs_f2",
    "docsF3": "docs_f3",
    "rutaDocumentos": "ruta_documentos",
    "numeroSecop": "numero_secop",
    "secop": "secop",
    "equipoActual": "equipo_actual",
    "historial": "historial",
    "adiciones": "adiciones",
    "pagos": "pagos",
    "adicion": "adicion",
    "valorAdicion": "valor_adicion",
    "pagado": "pagado",
    "actasPago": "actas_pago",
    "retencion": "retencion",
    "fechaInicio": "fecha_inicio",
    "fechaFin": "fecha_fin",
    "fechaActaFinal": "fecha_acta_final",
}


def to_row(proyecto: dict) -> dict:
    row = {}
    for js_key, col in FIELD_MAP.items():
        if js_key in proyecto:
            row[col] = proyecto[js_key]
    # normaliza fechas vacías ("") a None para que Postgres no reclame
    for date_col in ("fecha_inicio", "fecha_fin", "fecha_acta_final"):
        if row.get(date_col) == "":
            row[date_col] = None
    return row


def main():
    if not os.path.exists(RAW_DATA_PATH):
        sys.exit(f"No encontré {RAW_DATA_PATH}. Copia tu raw-data.json real ahí primero.")

    with open(RAW_DATA_PATH, "r", encoding="utf-8") as f:
        proyectos = json.load(f)

    client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)
    rows = [to_row(p) for p in proyectos]

    result = client.table("proyectos").upsert(rows, on_conflict="id").execute()
    print(f"Listo: {len(result.data)} proyectos sembrados/actualizados en Supabase.")


if __name__ == "__main__":
    main()
