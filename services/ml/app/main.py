import hmac
import logging
import math
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .features import FEATURES
from .model_loader import LoadedModel, load_approved_model
from .preprocessing import prepare_features, supports_original
from .schemas import PredictBatchRequest, PredictBatchResponse, PredictionResult

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = None
    try:
        app.state.model = load_approved_model()
    except Exception:
        logger.error("Modelo aprovado indisponível ou inválido")
    yield


app = FastAPI(
    title="SGEI ML interno",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def require_service_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> None:
    expected = os.getenv("ML_SERVICE_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    if credentials is None or not hmac.compare_digest(credentials.credentials, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


def active_model(request: Request) -> LoadedModel:
    model: LoadedModel | None = request.app.state.model
    if model is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Modelo indisponível")
    return model


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(request: Request) -> dict[str, object]:
    model = active_model(request)
    return {"status": "ready", "model_version": model.metadata.version,
            "original_input_ready": supports_original(model.metadata.dataset_sha256)}


@app.get("/internal/models/{version}", dependencies=[Depends(require_service_token)])
def model_info(version: str, request: Request) -> dict[str, object]:
    model = active_model(request)
    if version != model.metadata.version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return {
        "version": model.metadata.version,
        "classes": model.metadata.classes,
        "features": model.metadata.features,
        "calibrated": model.metadata.calibrated,
    }


@app.post(
    "/internal/predict-batch",
    response_model=PredictBatchResponse,
    dependencies=[Depends(require_service_token)],
)
def predict_batch(payload: PredictBatchRequest, request: Request) -> PredictBatchResponse:
    model = active_model(request)
    if payload.model_version != model.metadata.version:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Versão do modelo incompatível")

    try:
        rows = [prepare_features(item.features, payload.input_format, model.metadata.dataset_sha256)
                for item in payload.items]
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    probabilities = model.pipeline.predict_proba(rows)
    classes = list(model.pipeline.classes_)
    results: list[PredictionResult] = []
    for item, row in zip(payload.items, probabilities, strict=True):
        values = [float(value) for value in row]
        if not all(math.isfinite(value) and 0 <= value <= 1 for value in values):
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        if abs(sum(values) - 1) > 0.000001:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
        predicted = classes[max(range(len(values)), key=lambda index: values[index])]
        results.append(PredictionResult(
            ref=item.ref,
            predicted_class=predicted,
            probabilities=dict(zip(classes, values, strict=True)),
        ))
    return PredictBatchResponse(
        model_version=model.metadata.version,
        request_id=payload.request_id,
        results=results,
    )
