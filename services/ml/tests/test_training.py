import csv
import hashlib

import pytest

from app.features import CLASSES, FEATURES
from training.train import load_approved_csv, train


def synthetic_dataset(tmp_path):
    path = tmp_path / "external.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow([*FEATURES, "classe"])
        for index in range(90):
            values = [index % 4 for _ in FEATURES]
            values[FEATURES.index("idade_matricula")] = 18 + index % 15
            values[FEATURES.index("ucs_1sem_nota")] = 3 + index % 3 * 7
            writer.writerow([*values, CLASSES[index % 3]])
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return path, digest


def test_hash_aprovado_e_esquema_exato(tmp_path):
    path, digest = synthetic_dataset(tmp_path)
    with pytest.raises(ValueError, match="hash"):
        load_approved_csv(path, "0" * 64)
    features, labels, actual = load_approved_csv(path, digest)
    assert features.shape == (90, 36)
    assert set(labels) == set(CLASSES)
    assert actual == digest


def test_treino_offline_exporta_candidato_sem_publicar(tmp_path):
    path, digest = synthetic_dataset(tmp_path)
    output = tmp_path / "artifacts"
    metadata = train(path, digest, "fixture sintética", "fixture-v1", output)
    assert metadata["publication_status"] == "CANDIDATE"
    assert metadata["partition"] == {"train": 63, "validation": 13, "test": 14}
    assert (output / "model.joblib").is_file()
    assert (output / "metadata.json").is_file()
    with pytest.raises(FileExistsError):
        train(path, digest, "fixture sintética", "fixture-v1", output)
