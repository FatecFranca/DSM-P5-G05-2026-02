import numpy as np
import pytest

from training.calibration_assessment import assess_calibration


def test_perfect_probabilities_have_zero_gap_and_expected_count():
    result = assess_calibration(
        np.array([0, 0, 1, 1]), np.array([0.0, 0.0, 1.0, 1.0]),
        bins=2, bootstrap_repetitions=20,
    )
    assert result["expected_calibration_error"] == 0
    assert result["observed_minus_predicted"] == 0
    assert result["expected_dropout_count"] == 2
    assert sum(row["count"] for row in result["bins"]) == 4


def test_detects_systematic_underprediction():
    result = assess_calibration(
        np.array([1, 1, 1, 1]), np.array([0.2, 0.2, 0.2, 0.2]),
        bins=5, bootstrap_repetitions=20,
    )
    assert result["observed_minus_predicted"] == pytest.approx(0.8)
    assert result["expected_calibration_error"] == pytest.approx(0.8)
    assert result["observed_minus_predicted_95_ci"] == pytest.approx([0.8, 0.8])


def test_rejects_invalid_probabilities():
    with pytest.raises(ValueError):
        assess_calibration(np.array([0, 1]), np.array([0.5, 1.2]))
