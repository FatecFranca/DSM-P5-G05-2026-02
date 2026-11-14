"""Reproduz as etapas auditadas do notebook sem executar código do arquivo recebido.

Não treina nem altera o modelo. Só exporta parâmetros após conferir todo o CSV tratado.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np

from app.features import CATEGORICAL, FEATURES

ORIGINAL_COLUMNS = (
    'Marital status', 'Application mode', 'Application order', 'Course',
    'Daytime/evening attendance', 'Previous qualification', 'Previous qualification (grade)',
    'Nacionality', "Mother's qualification", "Father's qualification",
    "Mother's occupation", "Father's occupation", 'Admission grade', 'Displaced',
    'Educational special needs', 'Debtor', 'Tuition fees up to date', 'Gender',
    'Scholarship holder', 'Age at enrollment', 'International',
    'Curricular units 1st sem (credited)', 'Curricular units 1st sem (enrolled)',
    'Curricular units 1st sem (evaluations)', 'Curricular units 1st sem (approved)',
    'Curricular units 1st sem (grade)', 'Curricular units 1st sem (without evaluations)',
    'Curricular units 2nd sem (credited)', 'Curricular units 2nd sem (enrolled)',
    'Curricular units 2nd sem (evaluations)', 'Curricular units 2nd sem (approved)',
    'Curricular units 2nd sem (grade)', 'Curricular units 2nd sem (without evaluations)',
    'Unemployment rate', 'Inflation rate', 'GDP', 'Target',
)


def recover(raw: Path, processed: Path, notebook: Path, output: Path) -> dict:
    from training.train import load_approved_csv

    with raw.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.reader(handle, delimiter=';')
        if tuple(c.strip() for c in next(reader)) != ORIGINAL_COLUMNS:
            raise ValueError('Colunas originais incompatíveis')
        rows = []
        for row in reader:
            if len(row) != 37:
                raise ValueError('Linha incompleta')
            values = tuple(float(v) for v in row[:-1])
            if not np.isfinite(values).all():
                raise ValueError('Dados ausentes exigem análise específica; não imputar por classe')
            rows.append((*values, row[-1]))
    counts = {'original': len(rows)}
    rows = list(dict.fromkeys(rows))
    counts['after_duplicates'] = len(rows)
    occurrences = Counter(r[:-1] for r in rows)
    rows = [r for r in rows if occurrences[r[:-1]] == 1]
    counts['after_inconsistencies'] = len(rows)
    values = np.asarray([r[:-1] for r in rows], dtype=float)
    labels = np.asarray([r[-1] for r in rows])
    for name in ('nota_qual_anterior', 'nota_admissao'):
        i = FEATURES.index(name)
        q75, q25 = np.percentile(values[:, i], [75, 25])
        spread = 1.5 * (q75 - q25)
        keep = (values[:, i] <= q75 + spread) & (values[:, i] >= q25 - spread)
        values, labels = values[keep], labels[keep]
        counts['after_' + name] = len(values)
    numeric = [i for i, name in enumerate(FEATURES) if name not in CATEGORICAL]
    mean = np.mean(values[:, numeric], axis=0)
    std = np.std(values[:, numeric], axis=0, ddof=1)
    if not np.isfinite(std).all() or (std <= 0).any():
        raise ValueError('Desvio inválido')
    normalized = values.copy()
    normalized[:, numeric] = (values[:, numeric] - mean) / std
    processed_sha = hashlib.sha256(processed.read_bytes()).hexdigest()
    expected, expected_labels, _ = load_approved_csv(processed, processed_sha)
    if normalized.shape != expected.shape or not np.array_equal(labels, expected_labels):
        raise ValueError('Linhas ou classes não correspondem ao CSV tratado')
    if not np.allclose(normalized, expected, atol=1e-12, rtol=0):
        raise ValueError('Transformação não reproduz o CSV tratado')
    config = {
        'version': 'notebook-zscore-v1', 'ddof': 1,
        'dataset_sha256': processed_sha,
        'raw_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
        'notebook_sha256': hashlib.sha256(notebook.read_bytes()).hexdigest(),
        'features': list(FEATURES), 'counts': counts,
        'max_absolute_error': float(np.max(np.abs(normalized - expected))),
        'evaluation_limitation': 'Parâmetros calculados sobre toda a base limpa, antes da divisão de treino/teste.',
        'numeric': {FEATURES[i]: {'mean': float(mean[j]), 'std': float(std[j])}
                    for j, i in enumerate(numeric)},
        'categories': {name: sorted(set(values[:, i].tolist()))
                       for i, name in enumerate(FEATURES) if name in CATEGORICAL},
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(config, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return config


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ('raw', 'processed', 'notebook', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    result = recover(args.raw, args.processed, args.notebook, args.output)
    print(json.dumps({k: result[k] for k in ('counts', 'max_absolute_error', 'dataset_sha256')}))
