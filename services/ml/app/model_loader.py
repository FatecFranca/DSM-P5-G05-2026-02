import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import sklearn
from joblib.numpy_pickle import NumpyUnpickler
from pydantic import ValidationError

from .schemas import ModelMetadata
from .features import BINARY_CLASSES

ACTIVE_VERSION = 'externo-lr-sem-enrolled-v1'

_BINARY_GLOBALS = frozenset({
    ('sklearn.pipeline', 'Pipeline'),
    ('sklearn.compose._column_transformer', 'ColumnTransformer'),
    ('sklearn.preprocessing._data', 'StandardScaler'),
    ('sklearn.preprocessing._encoders', 'OneHotEncoder'),
    ('sklearn.preprocessing._function_transformer', 'FunctionTransformer'),
    ('sklearn.linear_model._logistic', 'LogisticRegression'),
    ('joblib.numpy_pickle', 'NumpyArrayWrapper'),
    ('numpy', 'float64'), ('numpy', 'ndarray'), ('numpy', 'dtype'),
    ('numpy._core.multiarray', '_reconstruct'),
    ('numpy._core.multiarray', 'scalar'),
    ('builtins', 'slice'),
})


class BinaryModelUnpickler(NumpyUnpickler):
    def find_class(self, module: str, name: str) -> Any:
        if (module, name) not in _BINARY_GLOBALS:
            raise ValueError('Tipo não permitido no artefato binário')
        return super().find_class(module, name)


def load_binary_pipeline(path: Path) -> Any:
    with path.open('rb') as handle:
        return BinaryModelUnpickler(str(path), handle, True).load()


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

    model_path = Path(os.getenv("ML_MODEL_PATH", "/models/externo-lr-sem-enrolled-v1/model.pkl"))
    metadata_path = Path(os.getenv("ML_METADATA_PATH", "/app/candidates/externo-lr-sem-enrolled-v1.json"))
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

    if (metadata.version != ACTIVE_VERSION or
            metadata.training_input_format != 'native_original' or
            metadata.classes != list(BINARY_CLASSES)):
        raise ValueError('Somente o modelo .pkl binário ativo pode ser carregado')
    if metadata.scikit_learn_version != sklearn.__version__:
        raise ValueError('Versão do scikit-learn incompatível com o modelo binário')
    pipeline = load_binary_pipeline(model_path)
    if list(getattr(pipeline, 'feature_names_in_', [])) != metadata.features:
        raise ValueError('Ordem dos atributos do modelo binário incompatível')
    try:
        categories = pipeline.named_steps['prep'].named_transformers_['nom'].categories_
        names = pipeline.named_steps['prep'].transformers_[1][2]
        if any(list(map(float, allowed)) != metadata.input_categories[name]
               for name, allowed in zip(names, categories, strict=True)):
            raise ValueError('Categorias do manifesto diferem do modelo .pkl')
    except (AttributeError, KeyError, IndexError, TypeError) as error:
        raise ValueError('Categorias do modelo .pkl indisponíveis') from error
    if not hasattr(pipeline, "predict_proba") or list(pipeline.classes_) != metadata.classes:
        raise ValueError("Pipeline incompatível com os metadados")
    return LoadedModel(pipeline=pipeline, metadata=metadata)
