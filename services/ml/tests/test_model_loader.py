import hashlib

import pytest

from app.model_loader import load_approved_model


def test_hash_incorreto_impede_carregamento_de_joblib(tmp_path, monkeypatch):
    artifact = tmp_path / "model.joblib"
    artifact.write_bytes(b"artefato nao confiavel")
    metadata = tmp_path / "metadata.json"
    metadata.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("ML_MODEL_PATH", str(artifact))
    monkeypatch.setenv("ML_METADATA_PATH", str(metadata))
    monkeypatch.setenv("ML_MODEL_APPROVED_SHA256", hashlib.sha256(b"outro").hexdigest())
    monkeypatch.setattr("app.model_loader.joblib.load", lambda _: pytest.fail("joblib foi chamado"))

    with pytest.raises(ValueError, match="Hash do modelo"):
        load_approved_model()
