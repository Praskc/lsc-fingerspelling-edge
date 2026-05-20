import os

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


DATA_ROOTS: list[str] = [
    r"C:\Users\esteb\OneDrive\Documentos\Proyectos III\ULT\train\images",
    r"C:\Users\esteb\OneDrive\Documentos\Proyectos III\ULT\ASL_Alphabet_Dataset\asl_alphabet_train",
]
OUTPUT_CSV  = os.path.join(_ROOT, 'lsc_master.csv')
CPU_WORKERS = max(1, (os.cpu_count() or 4) - 1)


ALFABETO      = [chr(i) for i in range(ord('a'), ord('z') + 1)]
VALID_CLASSES = set(ALFABETO + ['space', 'delete'])
KEYWORDS: dict[str, str] = {
    'space': 'space', 'nothing': 'space', 'blank': 'space',
    'del':   'delete', 'delete':  'delete', 'backspace': 'delete',
}
CARPETAS_EXCLUIDAS = {'images', 'train', 'test', 'asl_alphabet_train'}

COLS_CSV = (
    ['label']
    + [f'{i}_{a}' for i in range(21) for a in ['x', 'y']]
    + ['angulo_global']
)


N_FEATURES = 48   
N_CLASES   = 28    
PUNTAS     = [4, 8, 12, 16, 20]

LABEL_TO_INDEX: dict[str, int] = {
    chr(i): i - ord('a') for i in range(ord('a'), ord('z') + 1)
}
LABEL_TO_INDEX.update({'space': 26, 'delete': 27})
INDEX_TO_LABEL: dict[int, str] = {v: k for k, v in LABEL_TO_INDEX.items()}


CSV_FILES    = [os.path.join(_ROOT, 'lsc_master.csv'), os.path.join(_ROOT, 'hand_landmarks.csv')]
MAX_EPOCHS   = 100
PATIENCE     = 15
BATCH_SIZE   = 1024
LR           = 1e-3
WEIGHT_DECAY = 0.01


ONNX_PATH      = os.path.join(_ROOT, 'public', 'YOSO.onnx')
CENTROIDS_PATH = os.path.join(_ROOT, 'public', 'Centroides.json')
PTH_PATH       = os.path.join(_ROOT, 'ml', 'model', 'best_model.pth')
