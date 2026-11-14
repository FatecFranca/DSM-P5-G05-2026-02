import hashlib
import json
import pickle

import pytest

from app.model_loader import load_approved_model
from app.features import BINARY_CLASSES, FEATURES
from app.preprocessing import PARAMETERS


def test_hash_incorreto_impede_carregamento_de_joblib(tmp_path, monkeypatch):
    artifact = tmp_path / "model.joblib"
    artifact.write_bytes(b"artefato nao confiavel")
    metadata = tmp_path / "metadata.json"
    metadata.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("ML_MODEL_PATH", str(artifact))
    monkeypatch.setenv("ML_METADATA_PATH", str(metadata))
    monkeypatch.setenv("ML_MODEL_APPROVED_SHA256", hashlib.sha256(b"outro").hexdigest())

    with pytest.raises(ValueError, match="Hash do modelo"):
        load_approved_model()


def test_modelo_binario_recusa_tipo_nao_permitido_mesmo_com_hash(tmp_path, monkeypatch):
    artifact = tmp_path / 'model.pkl'
    artifact.write_bytes(pickle.dumps(eval))
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    metadata = tmp_path / 'metadata.json'
    metadata.write_text(json.dumps({
        'version': 'externo-lr-sem-enrolled-v1', 'features': FEATURES, 'classes': BINARY_CLASSES,
        'dataset_sha256': None, 'dataset_source': 'teste',
        'training_input_format': 'native_original', 'algorithm': 'teste',
        'artifact_sha256': digest, 'scikit_learn_version': '1.8.0',
        'input_categories': PARAMETERS['categories'],
    }), encoding='utf-8')
    monkeypatch.setenv('ML_MODEL_PATH', str(artifact))
    monkeypatch.setenv('ML_METADATA_PATH', str(metadata))
    monkeypatch.setenv('ML_MODEL_APPROVED_SHA256', digest)
    with pytest.raises(ValueError, match='Tipo não permitido'):
        load_approved_model()
