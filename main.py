from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

# 1. Inicialización única de la App
app = FastAPI(
    title="API de Optimización SEGIP",
    description="Backend para predecir tiempos de espera y horas óptimas"
)

# 2. Configuración de CORS (Solo una vez)
# Esto permite que tu Frontend en Vercel se conecte sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Carga del Dataset segura
try:
    base_path = os.path.dirname(__file__)
    file_path = os.path.join(base_path, "dataset.csv")
    df = pd.read_csv(file_path)
    print("✅ Dataset cargado correctamente con las columnas:", df.columns.tolist())
except Exception as e:
    print(f"❌ Error crítico al cargar el CSV: {e}")
    df = pd.DataFrame()

# 4. Ruta de inicio (Test)
@app.get("/")
def home():
    return {
        "status": "online",
        "mensaje": "API de Optimización de Trámites SEGIP activa",
        "endpoints": ["/docs", "/predict/{tramite}"]
    }

# 5. Ruta de Predicción Principal
@app.get("/predict/{tramite}")
def predecir(tramite: str):
    if df.empty:
        raise HTTPException(status_code=500, detail="El servidor no tiene datos cargados")

    # Filtro inteligente: Busca coincidencias ignorando mayúsculas y espacios
    # Esto ayuda si el frontend envía "Licencia de conducir" y el CSV dice "Licencia"
    nombre_buscado = tramite.strip().lower()
    
    filtro = df[
        df["tipo_tramite"]
        .astype(str)
        .str.lower()
        .apply(lambda x: nombre_buscado in x or x in nombre_buscado)
    ]

    if filtro.empty:
        return {
            "error": "Trámite no encontrado",
            "busqueda": tramite,
            "opciones_disponibles": df["tipo_tramite"].unique().tolist()
        }

    # Procesamiento de datos (Promedios por hora)
    horas = (
        filtro.groupby("hora")["tiempo_espera_min"]
        .mean()
        .reset_index()
    )

    # Encontrar la mejor fila (menor tiempo de espera)
    mejor_fila = horas.loc[horas["tiempo_espera_min"].idxmin()]
    
    mejor_hora_int = int(mejor_fila["hora"])
    espera_promedio = round(float(mejor_fila["tiempo_espera_min"]), 2)

    # Simulación de métricas para la interfaz
    congestion = min(int(espera_promedio * 2), 100) # Lógica simple de congestión
    confianza = 94 # Valor estático para la demo

    # Preparar la lista de horarios para los gráficos del Frontend
    horarios_grafico = []
    for _, row in horas.iterrows():
        carga_h = min(int(row["tiempo_espera_min"] * 2), 100)
        horarios_grafico.append({
            "hora": f"{int(row['hora'])}:00",
            "carga": carga_h
        })

    # Respuesta final que espera tu Frontend
    return {
        "hora_optima": f"{mejor_hora_int}:00",
        "confianza": confianza,
        "congestion_actual": congestion,
        "tiempo_espera_min": espera_promedio,
        "horarios": horarios_grafico,
        "recomendacion": (
            f"Basado en el histórico, el mejor horario para el trámite de {tramite} "
            f"es a las {mejor_hora_int}:00, con un tiempo promedio de {espera_promedio} min."
        )
    }