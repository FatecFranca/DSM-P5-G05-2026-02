"""Adaptador fixo para o CSV pré-processado; nunca ajusta parâmetros em inferência."""
import json
import math
from pathlib import Path

from .features import FEATURES

PARAMETERS = json.loads((Path(__file__).parent / 'preprocessing' / 'notebook-zscore-v1.json').read_text(encoding='utf-8'))


def supports_original(dataset_sha256: str) -> bool:
    return dataset_sha256 == PARAMETERS['dataset_sha256']


def prepare_features(features: dict[str, float], input_format: str, dataset_sha256: str) -> list[float]:
    if input_format == 'preprocessed':
        return [features[name] for name in FEATURES]
    if input_format != 'original' or not supports_original(dataset_sha256):
        raise ValueError('Pré-processamento incompatível com o dataset do modelo')
    for name, allowed in PARAMETERS['categories'].items():
        if features[name] not in allowed:
            raise ValueError(f'Código não suportado em {name}; use o código do dataset')
    for name in FEATURES:
        value = features[name]
        if name.startswith('ucs_') and not name.endswith('_nota') or name in ('idade_matricula', 'ordem_candidatura'):
            if value < 0 or not float(value).is_integer():
                raise ValueError(f'{name} deve ser inteiro não negativo na escala original')
        if name in ('nota_admissao', 'nota_qual_anterior') and not 0 <= value <= 200:
            raise ValueError(f'{name} deve usar a escala original de 0 a 200')
        if name in ('ucs_1sem_nota', 'ucs_2sem_nota') and not 0 <= value <= 20:
            raise ValueError(f'{name} deve usar a escala original de 0 a 20')
    result = []
    for name in FEATURES:
        value = features[name]
        parameters = PARAMETERS['numeric'].get(name)
        if parameters:
            value = (value - parameters['mean']) / parameters['std']
        if not math.isfinite(value):
            raise ValueError('Atributo excede os limites numéricos')
        result.append(value)
    return result
