import math

import pytest

from app.features import FEATURES
from app.preprocessing import PARAMETERS, prepare_features, supports_original


def original_features():
    features = {name: 0.0 for name in FEATURES}
    features.update({name: values[0] for name, values in PARAMETERS['categories'].items()})
    features.update(idade_matricula=20, nota_admissao=120, nota_qual_anterior=120)
    return features


def test_normaliza_somente_as_19_colunas_com_parametros_fixos():
    original = original_features()
    prepared = prepare_features(original, 'original', PARAMETERS['dataset_sha256'])
    assert len(PARAMETERS['numeric']) == 19
    assert PARAMETERS['ddof'] == 1
    for name, value in zip(FEATURES, prepared, strict=True):
        if name in PARAMETERS['numeric']:
            p = PARAMETERS['numeric'][name]
            assert value == (original[name] - p['mean']) / p['std']
        else:
            assert value == original[name]
    # O modo tratado deve passar sem aplicar z-score outra vez.
    assert prepare_features(dict(zip(FEATURES, prepared)), 'preprocessed', 'outro') == prepared
    assert original['idade_matricula'] == 20


def test_modelo_de_outro_dataset_nao_recebe_transformacao():
    assert not supports_original('a' * 64)
    with pytest.raises(ValueError, match='incompatível'):
        prepare_features(original_features(), 'original', 'a' * 64)


@pytest.mark.parametrize('name,value', [('curso', -1), ('genero', 2), ('ucs_1sem_nota', 21),
                                      ('idade_matricula', -1), ('ucs_1sem_aprovadas', 0.5),
                                      ('pib', math.inf)])
def test_recusa_codigos_escalas_e_valores_invalidos(name, value):
    with pytest.raises(ValueError):
        prepare_features({**original_features(), name: value}, 'original', PARAMETERS['dataset_sha256'])
