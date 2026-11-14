"""Treinamento offline; não importa código, dados ou conexões da API acadêmica."""

import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.features import CATEGORICAL, CLASSES, FEATURES
from training.recover_preprocessing import ORIGINAL_COLUMNS

NOMINAL = frozenset({
    "estado_civil", "modo_candidatura", "curso", "qualif_anterior",
    "nacionalidade", "qualif_mae", "qualif_pai", "ocupacao_mae", "ocupacao_pai",
})


def load_approved_csv(path: Path, approved_sha256: str) -> tuple[np.ndarray, np.ndarray, str]:
    actual_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_sha256 != approved_sha256.lower():
        raise ValueError("O hash do dataset não corresponde ao aprovado")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != [*FEATURES, "classe"]:
            raise ValueError("Colunas ou ordem do dataset incompatíveis")
        values: list[list[float]] = []
        labels: list[str] = []
        for row in reader:
            if None in row or row["classe"] not in CLASSES:
                raise ValueError("Linha ou classe inválida")
            try:
                features = [float(row[name]) for name in FEATURES]
            except (TypeError, ValueError) as error:
                raise ValueError("Atributo ausente ou não numérico") from error
            if not all(math.isfinite(value) for value in features):
                raise ValueError("Atributo não finito")
            values.append(features)
            labels.append(row["classe"])

    if len(values) < 30 or set(labels) != set(CLASSES):
        raise ValueError("Dataset insuficiente para as três classes")
    return np.asarray(values, dtype=np.float64), np.asarray(labels), actual_sha256


def load_raw_csv(path: Path, approved_sha256: str) -> tuple[np.ndarray, np.ndarray, str]:
    """Lê a fonte original aprovada, sem ajustar parâmetros nos dados completos."""
    actual_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual_sha256 != approved_sha256.lower():
        raise ValueError("O hash do dataset não corresponde ao aprovado")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, delimiter=";")
        if tuple(name.strip() for name in next(reader, ())) != ORIGINAL_COLUMNS:
            raise ValueError("Colunas ou ordem do dataset original incompatíveis")
        rows: list[tuple[float | str, ...]] = []
        for row in reader:
            if len(row) != len(ORIGINAL_COLUMNS) or row[-1] not in CLASSES:
                raise ValueError("Linha ou classe inválida")
            try:
                values = tuple(float(value) for value in row[:-1])
            except ValueError as error:
                raise ValueError("Atributo ausente ou não numérico") from error
            if not all(math.isfinite(value) for value in values):
                raise ValueError("Atributo não finito")
            rows.append((*values, row[-1]))

    # A deduplicação por igualdade não aprende parâmetros da distribuição.
    rows = list(dict.fromkeys(rows))
    occurrences = Counter(row[:-1] for row in rows)
    rows = [row for row in rows if occurrences[row[:-1]] == 1]
    if len(rows) < 30 or set(row[-1] for row in rows) != set(CLASSES):
        raise ValueError("Dataset insuficiente para as três classes")
    features = np.asarray([row[:-1] for row in rows], dtype=np.float64)
    labels = np.asarray([row[-1] for row in rows])
    return features, labels, actual_sha256


def remove_train_outliers(
    features: np.ndarray, labels: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, dict[str, int]]:
    """Aprende os limites IQR apenas no treino e não modifica validação/teste."""
    removed: dict[str, int] = {}
    for name in ("nota_qual_anterior", "nota_admissao"):
        column = features[:, FEATURES.index(name)]
        q25, q75 = np.percentile(column, [25, 75])
        lower, upper = q25 - 1.5 * (q75 - q25), q75 + 1.5 * (q75 - q25)
        keep = (column >= lower) & (column <= upper)
        removed[name] = int((~keep).sum())
        features, labels = features[keep], labels[keep]
    if len(features) < 30 or set(labels) != set(CLASSES):
        raise ValueError("Treino insuficiente após remoção de outliers")
    return features, labels, removed


def candidate(estimator: object, input_format: str = "preprocessed") -> Pipeline:
    categories = [index for index, name in enumerate(FEATURES)
                  if name in (NOMINAL if input_format == "raw" else CATEGORICAL)]
    numbers = [index for index, name in enumerate(FEATURES) if name not in CATEGORICAL]
    transformers = [
        ("categorical", OneHotEncoder(handle_unknown="ignore"), categories),
        ("numeric", StandardScaler(), numbers),
    ]
    if input_format == "raw":
        binaries = [index for index, name in enumerate(FEATURES)
                    if name in CATEGORICAL and name not in NOMINAL]
        transformers.append(("binary", "passthrough", binaries))
    preprocessing = ColumnTransformer(transformers)
    return Pipeline([("preprocessing", preprocessing), ("classifier", estimator)])


def train(dataset: Path, approved_sha256: str, source: str, version: str, output: Path,
          input_format: str = "preprocessed") -> dict[str, object]:
    if not source.strip() or not version.strip():
        raise ValueError("Origem e versão são obrigatórias")
    if input_format not in ("preprocessed", "raw"):
        raise ValueError("Formato de entrada inválido")
    model_path = output / "model.joblib"
    metadata_path = output / "metadata.json"
    if model_path.exists() or metadata_path.exists():
        raise FileExistsError("Artefatos existentes não serão sobrescritos")

    loader = load_raw_csv if input_format == "raw" else load_approved_csv
    features, labels, dataset_sha256 = loader(dataset, approved_sha256)
    input_categories = (
        {name: sorted(set(features[:, FEATURES.index(name)].tolist()))
         for name in CATEGORICAL}
        if input_format == "raw" else None
    )
    train_x, holdout_x, train_y, holdout_y = train_test_split(
        features, labels, test_size=0.30, stratify=labels, random_state=42,
    )
    validation_x, test_x, validation_y, test_y = train_test_split(
        holdout_x, holdout_y, test_size=0.50, stratify=holdout_y, random_state=42,
    )
    removed: dict[str, int] = {}
    if input_format == "raw":
        train_x, train_y, removed = remove_train_outliers(train_x, train_y)

    candidates = {
        "logistic_regression": candidate(LogisticRegression(
            class_weight="balanced", max_iter=2000, random_state=42,
        ), input_format),
        "random_forest": candidate(RandomForestClassifier(
            n_estimators=180, min_samples_leaf=3, class_weight="balanced_subsample",
            random_state=42, n_jobs=-1,
        ), input_format),
    }
    validation_scores: dict[str, float] = {}
    for name, pipeline in candidates.items():
        pipeline.fit(train_x, train_y)
        validation_scores[name] = float(f1_score(
            validation_y, pipeline.predict(validation_x), average="macro",
        ))
    winner_name = max(validation_scores, key=validation_scores.__getitem__)
    winner = candidates[winner_name]

    predictions = winner.predict(test_x)
    probabilities = winner.predict_proba(test_x)
    dropout_index = list(winner.classes_).index("Dropout")
    report = classification_report(test_y, predictions, labels=list(CLASSES), output_dict=True,
                                   zero_division=0)
    metrics = {
        "accuracy": float(accuracy_score(test_y, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(test_y, predictions)),
        "macro_f1": float(f1_score(test_y, predictions, average="macro")),
        "dropout_recall": float(report["Dropout"]["recall"]),
        "dropout_brier": float(brier_score_loss(test_y == "Dropout", probabilities[:, dropout_index])),
        "per_class": {label: {
            "precision": float(report[label]["precision"]),
            "recall": float(report[label]["recall"]),
            "f1": float(report[label]["f1-score"]),
            "support": int(report[label]["support"]),
        } for label in CLASSES},
        "confusion_matrix": confusion_matrix(test_y, predictions, labels=list(CLASSES)).tolist(),
    }

    output.mkdir(parents=True, exist_ok=True)
    joblib.dump(winner, model_path, compress=3)
    artifact_sha256 = hashlib.sha256(model_path.read_bytes()).hexdigest()
    metadata: dict[str, object] = {
        "version": version,
        "features": list(FEATURES),
        "classes": list(CLASSES),
        "dataset_sha256": dataset_sha256,
        "dataset_source": source,
        "training_input_format": "original" if input_format == "raw" else "preprocessed",
        "input_categories": input_categories,
        "outliers_removed_from_train": removed,
        "algorithm": winner_name,
        "artifact_sha256": artifact_sha256,
        "calibrated": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "scikit_learn_version": sklearn.__version__,
        "validation_macro_f1": validation_scores,
        "test_metrics": metrics,
        "partition": {"train": len(train_y), "validation": len(validation_y), "test": len(test_y)},
        "publication_status": "CANDIDATE",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Treina candidato somente com CSV externo aprovado")
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--approved-sha256", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--input-format", choices=("preprocessed", "raw"),
                        default="preprocessed")
    arguments = parser.parse_args()
    metadata = train(
        arguments.dataset, arguments.approved_sha256, arguments.source,
        arguments.version, arguments.output, arguments.input_format,
    )
    print(json.dumps({
        "version": metadata["version"],
        "algorithm": metadata["algorithm"],
        "validation_macro_f1": metadata["validation_macro_f1"],
        "test_metrics": metadata["test_metrics"],
        "publication_status": metadata["publication_status"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
