"""Descriptive probability calibration assessment on an untouched binary holdout."""

import math

import numpy as np


def _wilson_interval(positives: int, count: int) -> list[float]:
    z = 1.959963984540054
    rate = positives / count
    denominator = 1 + z * z / count
    center = (rate + z * z / (2 * count)) / denominator
    margin = z * math.sqrt(rate * (1 - rate) / count + z * z / (4 * count * count)) / denominator
    return [max(0.0, center - margin), min(1.0, center + margin)]


def assess_calibration(
    outcomes: np.ndarray,
    probabilities: np.ndarray,
    *,
    bins: int = 10,
    bootstrap_repetitions: int = 2000,
    seed: int = 7,
) -> dict[str, object]:
    """Describe reliability without deciding whether a model is approved for use."""
    actual = np.asarray(outcomes)
    predicted = np.asarray(probabilities, dtype=float)
    if (
        actual.ndim != 1 or predicted.ndim != 1 or actual.size != predicted.size
        or actual.size == 0 or not np.isin(actual, [0, 1]).all()
        or not np.isfinite(predicted).all() or ((predicted < 0) | (predicted > 1)).any()
        or bins < 2 or bootstrap_repetitions < 1
    ):
        raise ValueError("Rótulos ou probabilidades inválidos para avaliar calibração")

    actual = actual.astype(int)
    edges = np.linspace(0.0, 1.0, bins + 1)
    groups = np.digitize(predicted, edges[1:-1])
    rows: list[dict[str, object]] = []
    weighted_gap = 0.0
    maximum_gap = 0.0
    for index in range(bins):
        mask = groups == index
        count = int(mask.sum())
        if count == 0:
            continue
        positives = int(actual[mask].sum())
        mean_probability = float(predicted[mask].mean())
        observed_rate = positives / count
        gap = abs(observed_rate - mean_probability)
        weighted_gap += gap * count / actual.size
        maximum_gap = max(maximum_gap, gap)
        rows.append({
            "lower": float(edges[index]),
            "upper": float(edges[index + 1]),
            "count": count,
            "mean_probability": mean_probability,
            "observed_rate": observed_rate,
            "observed_wilson_95": _wilson_interval(positives, count),
        })

    differences = actual - predicted
    rng = np.random.default_rng(seed)
    bootstrap_gaps = np.array([
        differences[rng.integers(0, actual.size, size=actual.size)].mean()
        for _ in range(bootstrap_repetitions)
    ])
    return {
        "method": f"fixed_width_{bins}_bins_bootstrap_{bootstrap_repetitions}_seed_{seed}",
        "sample_size": int(actual.size),
        "expected_dropout_count": float(predicted.sum()),
        "observed_dropout_count": int(actual.sum()),
        "mean_probability": float(predicted.mean()),
        "observed_rate": float(actual.mean()),
        "observed_minus_predicted": float(differences.mean()),
        "observed_minus_predicted_95_ci": [float(value) for value in np.quantile(bootstrap_gaps, [0.025, 0.975])],
        "expected_calibration_error": weighted_gap,
        "maximum_bin_gap": maximum_gap,
        "bins": rows,
    }
