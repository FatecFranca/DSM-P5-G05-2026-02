"""Reproduce the held-out evaluation of the active binary model."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, brier_score_loss, confusion_matrix, f1_score, recall_score
from sklearn.model_selection import train_test_split

from app.features import FEATURES
from app.model_loader import load_binary_pipeline
from training.calibration_assessment import assess_calibration


def load_verified_holdout(dataset: Path, model_file: Path, dataset_sha256: str, model_sha256: str):
    if hashlib.sha256(dataset.read_bytes()).hexdigest() != dataset_sha256:
        raise ValueError("CSV diferente do conjunto de referência")
    if hashlib.sha256(model_file.read_bytes()).hexdigest() != model_sha256:
        raise ValueError("Artefato diferente do modelo ativo")

    model = load_binary_pipeline(model_file)
    data = pd.read_csv(dataset, sep=";")
    if data.shape != (4424, len(FEATURES) + 1) or data.columns[-1] != "Target":
        raise ValueError("Formato do CSV de referência incompatível")
    features = data.iloc[:, :-1].copy()
    features.columns = list(FEATURES)
    labels = data["Target"]
    binary = labels.isin(["Dropout", "Graduate"])
    features, labels = features.loc[binary], labels.loc[binary]
    x_train, x_validation, _, y_validation = train_test_split(
        features, labels, test_size=0.20, random_state=7, stratify=labels,
    )
    for column in ("nota_qual_anterior", "nota_admissao"):
        q75, q25 = np.percentile(x_train[column].values, [75, 25])
        iqr = q75 - q25
        x_train = x_train[
            (x_train[column] <= q75 + 1.5 * iqr)
            & (x_train[column] >= q25 - 1.5 * iqr)
        ]

    _, scaler, columns = model.named_steps["prep"].transformers_[0]
    if (
        len(x_train) != int(scaler.n_samples_seen_)
        or not np.allclose(x_train[list(columns)].mean().to_numpy(), scaler.mean_, rtol=0, atol=1e-12)
        or not np.allclose(x_train[list(columns)].std(ddof=0).to_numpy(), scaler.scale_, rtol=0, atol=1e-12)
    ):
        raise ValueError("Divisão reconstruída não corresponde ao ajuste do modelo")

    return model, x_validation, y_validation, len(x_train)


def evaluate(dataset: Path, model_file: Path, dataset_sha256: str, model_sha256: str) -> dict[str, object]:
    model, x_validation, y_validation, training_size = load_verified_holdout(
        dataset, model_file, dataset_sha256, model_sha256,
    )

    predicted = model.predict(x_validation)
    dropout_probability = model.predict_proba(x_validation)[:, list(model.classes_).index("Dropout")]
    calibration = assess_calibration(
        (y_validation == "Dropout").to_numpy(dtype=int), dropout_probability,
    )
    return {
        "model_version": "externo-lr-sem-enrolled-v1",
        "dataset_sha256": dataset_sha256,
        "artifact_sha256": model_sha256,
        "train_after_outliers": training_size,
        "validation_samples": len(x_validation),
        "accuracy": accuracy_score(y_validation, predicted),
        "macro_f1": f1_score(y_validation, predicted, average="macro"),
        "dropout_recall": recall_score(y_validation, predicted, pos_label="Dropout"),
        "dropout_brier": brier_score_loss((y_validation == "Dropout").astype(int), dropout_probability),
        "calibration_assessment": calibration,
        "confusion_matrix_dropout_graduate": confusion_matrix(
            y_validation, predicted, labels=["Dropout", "Graduate"],
        ).tolist(),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--dataset-sha256", required=True)
    parser.add_argument("--model-sha256", required=True)
    arguments = parser.parse_args()
    print(json.dumps(evaluate(
        arguments.dataset, arguments.model,
        arguments.dataset_sha256.lower(), arguments.model_sha256.lower(),
    ), ensure_ascii=False, indent=2))
