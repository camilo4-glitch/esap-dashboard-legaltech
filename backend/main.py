import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os

app = FastAPI(title="ESAP-LegalTech Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Etapa(BaseModel):
    key: str
    label: str
    status: str

class Proyecto(BaseModel):
    id: Optional[int] = None
    row: Optional[int] = None
    categoria: Optional[str] = None
    proyecto: str
    tecnico: Optional[str] = None
    juridico: Optional[str] = None
    abogado_contratacion: Optional[str] = None
    tipo_proceso: Optional[str] = None
    objeto: Optional[str] = None
    estudio_mercado: Optional[str] = None
    cdp: Optional[str] = None
    valor_proceso: Optional[float] = None
    avance_documental: Optional[float] = None
    estado: str
    fase_actual: Optional[str] = None
    etapas: List[Etapa] = []
    observaciones: Optional[str] = None
    compromisos: Optional[str] = None
    dependencia: Optional[str] = None
    nota_fecha: Optional[str] = None
    manual_override: Optional[bool] = False
    override_note: Optional[str] = None

# Mock database
proyectos_db: List[Proyecto] = []

@app.on_event("startup")
def load_data():
    global proyectos_db
    try:
        with open("raw-data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            # Some mapping may be required, but Pydantic BaseModel handles extra keys usually by ignoring them if not in model,
            # or we can pass dict directly. Let's create Proyecto instances.
            for idx, item in enumerate(data):
                # Ensure it has an id
                item['id'] = item.get('id', idx + 1)
                
                # We need to map some missing fields if they are None but required
                if 'proyecto' not in item or not item['proyecto']:
                    item['proyecto'] = "Proyecto Sin Nombre"
                if 'estado' not in item or not item['estado']:
                    item['estado'] = "Pendiente"
                    
                proyectos_db.append(Proyecto(**item))
        print(f"Loaded {len(proyectos_db)} projects from raw-data.json")
    except Exception as e:
        print(f"Error loading initial data: {e}")

@app.get("/api/proyectos", response_model=List[Proyecto])
def get_proyectos():
    return proyectos_db

@app.post("/api/proyectos", response_model=Proyecto)
def create_proyecto(proyecto: Proyecto):
    new_id = max([p.id for p in proyectos_db]) + 1 if proyectos_db else 1
    proyecto.id = new_id
    
    # Generate stages if not present
    if not proyecto.etapas:
        proyecto.etapas = [
            Etapa(key="estructuracion", label="Estructuración", status="pendiente"),
            Etapa(key="fase1", label="Fase 1 · Anexos y cotización", status="pendiente"),
            Etapa(key="fase2", label="Fase 2 · Estudios y pliego", status="pendiente"),
            Etapa(key="fase3", label="Fase 3 · Evaluación y adjudicación", status="pendiente"),
            Etapa(key="ejecucion", label="Ejecución (Acta de inicio)", status="pendiente")
        ]
        
    proyectos_db.append(proyecto)
    return proyecto

@app.put("/api/proyectos/{proyecto_id}", response_model=Proyecto)
def update_proyecto(proyecto_id: int, proyecto_actualizado: Proyecto):
    for index, p in enumerate(proyectos_db):
        if p.id == proyecto_id:
            proyecto_actualizado.id = proyecto_id
            proyectos_db[index] = proyecto_actualizado
            return proyecto_actualizado
    return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
