from uuid import uuid4

from fastapi.testclient import TestClient

from app.features import CLASSES, FEATURES
from app.main import app
from app.model_loader import LoadedModel
from app.schemas import ModelMetadata
from app.preprocessing import PARAMETERS, prepare_features
from test_preprocessing import original_features


TOKEN = "s" * 40


class FakePipeline:
    classes_ = CLASSES

    def predict_proba(self, rows):
        return [[0.7, 0.2, 0.1] for _ in rows]


def model() -> LoadedModel:
    metadata = ModelMetadata(
        version="teste-v1", features=list(FEATURES), classes=list(CLASSES),
        dataset_sha256="a" * 64, dataset_source="dataset sintético",
        algorithm="teste", artifact_sha256="b" * 64,
    )
    return LoadedModel(FakePipeline(), metadata)


def payload() -> dict:
    return {
        "model_version": "teste-v1",
        "request_id": str(uuid4()),
        "items": [{
            "ref": str(uuid4()),
            "features": {feature: 1 for feature in FEATURES},
        }],
    }


def test_sem_artefato_nao_inventa_previsao(monkeypatch):
    monkeypatch.setenv("ML_SERVICE_TOKEN", TOKEN)
    monkeypatch.setattr("app.main.load_approved_model", lambda: None)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/ready").status_code == 503
        response = client.post(
            "/internal/predict-batch", json=payload(),
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert response.status_code == 503


def test_autorizacao_contrato_e_versao(monkeypatch):
    monkeypatch.setenv("ML_SERVICE_TOKEN", TOKEN)
    loads = []

    def load():
        loads.append(1)
        return model()

    monkeypatch.setattr("app.main.load_approved_model", load)
    with TestClient(app) as client:
        assert client.get("/ready").json()["model_version"] == "teste-v1"
        assert client.post("/internal/predict-batch", json=payload()).status_code == 401

        body = payload()
        response = client.post(
            "/internal/predict-batch", json=body,
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        assert response.status_code == 200
        result = response.json()["results"][0]
        assert result["ref"] == body["items"][0]["ref"]
        assert result["predicted_class"] == "Dropout"
        assert sum(result["probabilities"].values()) == 1

        body["items"][0]["features"].pop("pib")
        assert client.post(
            "/internal/predict-batch", json=body,
            headers={"Authorization": f"Bearer {TOKEN}"},
        ).status_code == 422
        body = payload()
        body["model_version"] = "outra-versao"
        assert client.post(
            "/internal/predict-batch", json=body,
            headers={"Authorization": f"Bearer {TOKEN}"},
        ).status_code == 409
    assert loads == [1]


def test_entrada_original_e_tratada_chegam_iguais_ao_modelo(monkeypatch):
    loaded = model()
    loaded.metadata.dataset_sha256 = PARAMETERS['dataset_sha256']
    seen = []
    def predict(rows):
        seen.extend(rows)
        return [[0.7, 0.2, 0.1] for _ in rows]
    loaded.pipeline.predict_proba = predict
    monkeypatch.setenv('ML_SERVICE_TOKEN', TOKEN)
    monkeypatch.setattr('app.main.load_approved_model', lambda: loaded)
    with TestClient(app) as client:
        assert client.get('/ready').json()['original_input_ready'] is True
        body = payload()
        body['input_format'] = 'original'
        body['items'][0]['features'] = original_features()
        headers = {'Authorization': f'Bearer {TOKEN}'}
        original = client.post('/internal/predict-batch', json=body, headers=headers)
        assert original.status_code == 200
        body['items'][0]['features'] = dict(zip(FEATURES, prepare_features(original_features(), 'original', PARAMETERS['dataset_sha256'])))
        body['input_format'] = 'preprocessed'
        processed = client.post('/internal/predict-batch', json=body, headers=headers)
        assert processed.json() == original.json()
        assert seen[0] == seen[1]
        body['input_format'] = 'unknown'
        assert client.post('/internal/predict-batch', json=body, headers=headers).status_code == 422
