import math
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .features import BINARY_CLASSES, CATEGORICAL, CLASSES, FEATURES


class PredictionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ref: UUID
    features: dict[str, float]

    @field_validator("features", mode="before")
    @classmethod
    def validate_features(cls, value: object) -> object:
        if not isinstance(value, dict) or set(value) != set(FEATURES):
            raise ValueError("O conjunto de 36 atributos deve corresponder ao modelo")
        if any(
            isinstance(item, bool)
            or not isinstance(item, (int, float))
            or not math.isfinite(item)
            for item in value.values()
        ):
            raise ValueError("Atributos devem ser números finitos")
        return value


class PredictBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model_version: Annotated[str, Field(min_length=1, max_length=100)]
    input_format: Literal['preprocessed', 'original'] = 'preprocessed'
    request_id: UUID
    items: Annotated[list[PredictionItem], Field(min_length=1, max_length=100)]

    @model_validator(mode="after")
    def unique_references(self) -> "PredictBatchRequest":
        if len({item.ref for item in self.items}) != len(self.items):
            raise ValueError("Referências duplicadas no lote")
        return self


class PredictionResult(BaseModel):
    ref: UUID
    predicted_class: str
    probabilities: dict[str, float]


class PredictBatchResponse(BaseModel):
    model_version: str
    request_id: UUID
    results: list[PredictionResult]


class ModelMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: str
    features: list[str]
    classes: list[str]
    dataset_sha256: str | None
    dataset_source: str
    training_input_format: Literal["preprocessed", "original", "native_original"] = "preprocessed"
    input_categories: dict[str, list[float]] | None = None
    algorithm: str
    artifact_sha256: str
    calibrated: bool = False
    scikit_learn_version: str | None = None

    @model_validator(mode="after")
    def validate_contract(self) -> "ModelMetadata":
        if self.features != list(FEATURES) or self.classes not in (list(CLASSES), list(BINARY_CLASSES)):
            raise ValueError("Esquema do artefato incompatível")
        if len(self.artifact_sha256) != 64 or (self.dataset_sha256 is not None and len(self.dataset_sha256) != 64):
            raise ValueError("Hash do artefato ou dataset inválido")
        if self.training_input_format == "native_original" and (
            self.classes != list(BINARY_CLASSES) or self.scikit_learn_version is None
        ):
            raise ValueError("Contrato do modelo binário inválido")
        if self.training_input_format != "native_original" and self.dataset_sha256 is None:
            raise ValueError("Hash do dataset obrigatório")
        if self.training_input_format in ("original", "native_original") and (
            self.input_categories is None
            or set(self.input_categories) != CATEGORICAL
            or any(not values or any(not math.isfinite(value) for value in values)
                   for values in self.input_categories.values())
        ):
            raise ValueError("Categorias do dataset original ausentes ou inválidas")
        return self
