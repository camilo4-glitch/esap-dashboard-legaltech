# ESAP-LegalTech Dashboard

Este es el proyecto inicial del Dashboard de Proyectos para la Escuela Superior de Administración Pública (ESAP), alineado con el ecosistema de ESAP-LegalTech.

## Tecnologías Utilizadas (Tech Stack Oficial)

- **Backend:** Python con FastAPI.
- **Frontend:** React (Vite) con Tailwind CSS.
- **Base de Datos:** Memoria (preparado para ser integrado con bases de datos relacionales y vectoriales como ChromaDB para el Asistente Jurídico).

## Estructura del Proyecto

- `/backend/`: Contiene la API REST desarrollada en FastAPI.
  - `main.py`: Archivo principal con los endpoints del servidor (`/api/proyectos`).
- `/frontend/`: Contiene la aplicación web construida con React y Tailwind CSS.
  - `src/App.jsx`: Componente principal que replica la interfaz del dashboard.

## Cómo ejecutar el proyecto localmente

### 1. Levantar el Backend (FastAPI)

1. Abre una terminal y navega a la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Activa el entorno virtual:
   ```bash
   venv\Scripts\activate
   ```
3. Ejecuta el servidor:
   ```bash
   python main.py
   ```
   El backend se ejecutará en `http://localhost:8000`.

### 2. Levantar el Frontend (React)

1. Abre otra terminal y navega a la carpeta `frontend`:
   ```bash
   cd frontend
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   El frontend estará disponible en `http://localhost:5173`.

## Funcionalidades Actuales

- **Visualización en Tiempo Real:** Los proyectos mostrados en las tablas provienen directamente de la API de FastAPI.
- **Filtros por Sede:** Puedes alternar entre "Sede Central" y "Territoriales" utilizando las pestañas superiores.
- **UI Corporativa:** El dashboard hereda los lineamientos estéticos (colores navy, teal, gold) solicitados.
