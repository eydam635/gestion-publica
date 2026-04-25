from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargamos el dataset al iniciar (Asegúrate que el nombre coincida)
try:
    df = pd.read_csv("dataset.csv") # Nombre según tu código previo
    print(df["tipo_tramite"].unique())
except FileNotFoundError:
    print("Error: No se encontró el archivo CSV.")

@app.get("/")
def home():
    return {"mensaje": "API de Optimización de Trámites SEGIP activa"}

@app.get("/predict/{tramite}")
def predecir(tramite: str):

    filtro = df[
        df["tipo_tramite"]
        .astype(str)
        .str.strip()
        .str.lower()
        == tramite.strip().lower()
    ]

    if filtro.empty:
        return {
            "error": "Trámite no encontrado"
        }

    # promedio por hora
    horas = (
        filtro.groupby("hora")["tiempo_espera_min"]
        .mean()
        .reset_index()
    )

    # mejor hora
    mejor_fila = horas.loc[
        horas["tiempo_espera_min"].idxmin()
    ]

    mejor_hora = int(mejor_fila["hora"])

    # tiempo espera promedio
    espera = round(
        float(mejor_fila["tiempo_espera_min"]),
        2
    )

    # simulación de congestión
    congestion = min(
        int(espera * 2),
        100
    )

    # confianza simulada
    confianza = 94

    # horarios para gráficos
    horarios = []

    for _, row in horas.iterrows():

        carga = min(
            int(row["tiempo_espera_min"] * 2),
            100
        )

        horarios.append({
            "hora": f"{int(row['hora'])}:00",
            "carga": carga
        })

    return {

        "hora_optima": f"{mejor_hora}:00",

        "confianza": confianza,

        "congestion_actual": congestion,

        "tiempo_espera_min": espera,

        "horarios": horarios,

        "recomendacion":
        f"El mejor horario para realizar el trámite de {tramite} es a las {mejor_hora}:00, ya que presenta menor congestión y menor tiempo de espera."
    }