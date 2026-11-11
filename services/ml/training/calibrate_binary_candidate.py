"""Fit an external sigmoid calibration candidate and test it on separate holdout rows."""

import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.model_selection import train_test_split

from training.calibration_assessment import assess_calibration
from training.evaluate_binary_candidate import load_verified_holdout


def _scores(actual: np.ndarray, probabilities: np.ndarray) -> dict[str, object]:
    calibration = assess_calibration(actual, probabilities)
    return {
        "brier": float(brier_score_loss(actual, probabilities)),
        "log_loss": float(log_loss(actual, probabilities, labels=[0, 1])),
        "expected_calibration_error": calibration["expected_calibration_error"],
        "mean_probability": calibration["mean_probability"],
        "observed_rate": calibration["observed_rate"],
        "observed_minus_predicted": calibration["observed_minus_predicted"],
        "observed_minus_predicted_95_ci": calibration["observed_minus_predicted_95_ci"],
    }


def calibrate(dataset: Path, model_file: Path, dataset_sha256: str, model_sha256: str) -> dict[str, object]:
    model, features, labels, _ = load_verified_holdout(
        dataset, model_file, dataset_sha256, model_sha256,
    )
    calibration_x, test_x, calibration_y, test_y = train_test_split(
        features, labels, test_size=0.5, random_state=17, stratify=labels,
    )
    if not calibration_x.index.is_unique or not test_x.index.is_unique:
        raise ValueError("Índices duplicados no conjunto de validação")
    if set(calibration_x.index) & set(test_x.index):
        raise ValueError("Vazamento entre ajuste de calibração e teste")

    calibrated = CalibratedClassifierCV(
        estimator=FrozenEstimator(model), method="sigmoid",
    ).fit(calibration_x, calibration_y)
    actual = (test_y == "Dropout").to_numpy(dtype=int)
    raw = model.predict_proba(test_x)[:, list(model.classes_).index("Dropout")]
    adjusted = calibrated.predict_proba(test_x)[:, list(calibrated.classes_).index("Dropout")]
    brier_differences = (actual - raw) ** 2 - (actual - adjusted) ** 2
    rng = np.random.default_rng(17)
    bootstrap_improvements = np.array([
        brier_differences[rng.integers(0, len(actual), size=len(actual))].mean()
        for _ in range(2000)
    ])
    return {
        "model_version": "externo-lr-sem-enrolled-v1",
        "dataset_sha256": dataset_sha256,
        "artifact_sha256": model_sha256,
        "method": "sigmoid_FrozenEstimator",
        "split": "original_holdout_80_20_seed_7_then_stratified_50_50_seed_17",
        "calibration_samples": len(calibration_y),
        "test_samples": len(test_y),
        "test_dropout_count": int(actual.sum()),
        "raw_test": _scores(actual, raw),
        "calibrated_test": _scores(actual, adjusted),
        "brier_improvement": float(brier_differences.mean()),
        "brier_improvement_95_ci": [
            float(value) for value in np.quantile(bootstrap_improvements, [0.025, 0.975])
        ],
        "publication_status": "EXTERNAL_EXPERIMENT_ONLY",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--dataset-sha256", required=True)
    parser.add_argument("--model-sha256", required=True)
    arguments = parser.parse_args()
    print(json.dumps(calibrate(
        arguments.dataset, arguments.model,
        arguments.dataset_sha256.lower(), arguments.model_sha256.lower(),
    ), ensure_ascii=False, indent=2))
