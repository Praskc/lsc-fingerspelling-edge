import os
import sys
import cv2
import numpy as np
import onnxruntime as ort
import mediapipe as mp
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
from concurrent.futures import ProcessPoolExecutor
from sklearn.metrics import classification_report, confusion_matrix
from tqdm import tqdm

# Silenciar advertencias
warnings.filterwarnings("ignore", category=UserWarning, module='google.protobuf.symbol_database')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.config import ONNX_PATH, INDEX_TO_LABEL, LABEL_TO_INDEX
from ml.features import recalibrar, construir_features

DATASET_VAL_PATH = r"C:\Users\Esteban\Documents\src\ml\ASL Alphabet Dataset Cabana 2025\Train"
NUM_WORKERS = 12

detector = None
ort_session = None
input_name = None

def init_worker():
    """Inicializa MediaPipe y ONNX una sola vez por cada proceso."""
    global detector, ort_session, input_name
    detector = mp.solutions.hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.5
    )
    ort_session = ort.InferenceSession(ONNX_PATH)
    input_name = ort_session.get_inputs()[0].name

def procesar_imagen_tarea(datos):
    """Tarea unitaria para cada núcleo."""
    ruta_img, indice_real = datos
    global detector, ort_session, input_name
    
    img = cv2.imread(ruta_img)
    if img is None:
        return None

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    resultado = detector.process(img_rgb)

    if resultado.multi_hand_landmarks:
        puntos_raw = np.array([[p.x, p.y] for p in resultado.multi_hand_landmarks[0].landmark])
        
        # Lógica de preprocesamiento idéntica al entrenamiento
        temp = recalibrar(puntos_raw)
        if temp is None:
            return None
        
        pts_norm, angulo = temp
        vector_48 = construir_features(pts_norm, angulo)

        # Inferencia
        input_data = vector_48.reshape(1, -1).astype(np.float32)
        output = ort_session.run(None, {input_name: input_data})[0]
        
        return (indice_real, np.argmax(output))
    return None

def validar_paralelo():
    print(f"Preparando validación paralela con {NUM_WORKERS} hilos...")
    
    # 1. Mapeo de todas las imágenes del dataset excluyendo space y delete
    tareas = []
    for nombre_carpeta in os.listdir(DATASET_VAL_PATH):
        ruta_carpeta = os.path.join(DATASET_VAL_PATH, nombre_carpeta)
        if not os.path.isdir(ruta_carpeta): continue
        
        clase_label = nombre_carpeta.lower()
        
        # Ignorar si no está en config o si es space/delete explícitamente
        if clase_label not in LABEL_TO_INDEX: continue
        if clase_label in ['space', 'delete', 'del']: continue
        
        indice_real = LABEL_TO_INDEX[clase_label]
        for archivo in os.listdir(ruta_carpeta):
            if archivo.lower().endswith(('.jpg', '.jpeg', '.png')):
                tareas.append((os.path.join(ruta_carpeta, archivo), indice_real))

    total_tareas = len(tareas)
    print(f"Total de imágenes a procesar: {total_tareas}")

    # 2. Ejecución en paralelo con barra de progreso
    y_true = []
    y_pred = []

    with ProcessPoolExecutor(max_workers=NUM_WORKERS, initializer=init_worker) as executor:
        # tqdm envuelve el iterador map para mostrar el progreso en tiempo real
        resultados = list(tqdm(executor.map(procesar_imagen_tarea, tareas), total=total_tareas, desc="Procesando", unit="img"))

    # 3. Filtrado de resultados válidos
    for res in resultados:
        if res is not None:
            y_true.append(res[0])
            y_pred.append(res[1])

    # 4. Generación de Reportes Técnicos
    print("\nValidación Finalizada.")
    
    if not y_true:
        print("No se extrajeron landmarks de ninguna imagen.")
        return

    clases_presentes = sorted(list(set(y_true) | set(y_pred)))
    target_names = [INDEX_TO_LABEL[i] for i in clases_presentes]
    
    print(classification_report(y_true, y_pred, target_names=target_names))

    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(14, 11))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=target_names, yticklabels=target_names)
    
    plt.title('Matriz de Confusión - YOSO Beta Edition')
    plt.xlabel('Predicción')
    plt.ylabel('Realidad')
    plt.savefig('matriz_validacion_paralela.png', dpi=300)
    plt.show()

if __name__ == "__main__":
    validar_paralelo()