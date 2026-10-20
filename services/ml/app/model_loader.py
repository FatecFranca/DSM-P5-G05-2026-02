import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
from pydantic import ValidationError

from .schemas import ModelMetadata


@dataclass(frozen=True)
class LoadedModel:
    pipeline: Any
    metadata: ModelMetadata


def load_approved_model() -> LoadedModel | None:
    approved_sha = os.getenv("ML_MODEL_APPROVED_SHA256", "").lower()
    if not approved_sha:
        return None
    if len(approved_sha) != 64 or any(c not in "0123456789abcdef" for c in approved_sha):
        raise ValueError("Hash de aprovação inválido")

    model_path = Path(os.getenv("ML_MODEL_PATH", "/models/model.joblib"))
    metadata_path = Path(os.getenv("ML_METADATA_PATH", "/models/metadata.json"))
    if not model_path.is_file() or not metadata_path.is_file():
        return None

    actual_sha = hashlib.sha256(model_path.read_bytes()).hexdigest()
    if actual_sha != approved_sha:
        raise ValueError("Hash do modelo difere do aprovado")
    try:
        metadata = ModelMetadata.model_validate(json.loads(metadata_path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, ValidationError) as error:
        raise ValueError("Metadados do modelo inválidos") from error
    if metadata.artifact_sha256 != actual_sha:
        raise ValueError("Metadados não correspondem ao artefato")

    # joblib usa pickle: somente o artefato cujo hash foi aprovado pode ser carregado.
    pipeline = joblib.load(model_path)
    if not hasattr(pipeline, "predict_proba") or set(pipeline.classes_) != set(metadata.classes):
        raise ValueError("Pipeline incompatível com os metadados")
    return LoadedModel(pipeline=pipeline, metadata=metadata)
