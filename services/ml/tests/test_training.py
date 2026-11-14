import csv
import hashlib

import pytest

from app.features import CLASSES, FEATURES
from training.recover_preprocessing import ORIGINAL_COLUMNS
from training.train import load_approved_csv, load_raw_csv, remove_train_outliers, train
import numpy as np


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


def synthetic_raw_dataset(tmp_path):
    path = tmp_path / "raw.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle, delimiter=";")
        writer.writerow([*ORIGINAL_COLUMNS[:4], "Daytime/evening attendance\t", *ORIGINAL_COLUMNS[5:]])
        for index in range(90):
            values = [index % 4 for _ in FEATURES]
            values[FEATURES.index("idade_matricula")] = 18 + index % 15
            values[FEATURES.index("nota_qual_anterior")] = 100 + index % 9
            values[FEATURES.index("nota_admissao")] = 110 + index % 12
            values[FEATURES.index("ucs_1sem_nota")] = 3 + index % 3 * 7
            writer.writerow([*values, CLASSES[index % 3]])
    return path, hashlib.sha256(path.read_bytes()).hexdigest()


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


def test_dataset_bruto_e_treino_sem_filtrar_validacao(tmp_path):
    path, digest = synthetic_raw_dataset(tmp_path)
    with pytest.raises(ValueError, match="hash"):
        load_raw_csv(path, "0" * 64)
    features, labels, actual = load_raw_csv(path, digest)
    assert features.shape == (90, 36)
    assert set(labels) == set(CLASSES)
    assert actual == digest

    output = tmp_path / "raw-artifacts"
    metadata = train(path, digest, "fixture bruta", "fixture-raw-v1", output, "raw")
    assert metadata["training_input_format"] == "original"
    assert metadata["input_categories"]["curso"] == [0.0, 1.0, 2.0, 3.0]
    assert metadata["partition"]["validation"] == 13
    assert metadata["partition"]["test"] == 14
    assert (output / "model.joblib").is_file()


def test_limites_de_outliers_usam_somente_o_treino():
    features = np.zeros((60, len(FEATURES)))
    features[:, FEATURES.index("nota_qual_anterior")] = 120
    features[-1, FEATURES.index("nota_qual_anterior")] = 190
    features[:, FEATURES.index("nota_admissao")] = 130
    labels = np.asarray([CLASSES[index % 3] for index in range(60)])
    filtered, filtered_labels, removed = remove_train_outliers(features, labels)
    assert removed == {"nota_qual_anterior": 1, "nota_admissao": 0}
    assert len(filtered) == len(filtered_labels) == 59
    assert len(features) == 60
