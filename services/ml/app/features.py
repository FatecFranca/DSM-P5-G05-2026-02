FEATURES = (
    "estado_civil", "modo_candidatura", "ordem_candidatura", "curso",
    "periodo_aula", "qualif_anterior", "nota_qual_anterior", "nacionalidade",
    "qualif_mae", "qualif_pai", "ocupacao_mae", "ocupacao_pai",
    "nota_admissao", "deslocado", "necessidades_especiais", "devedor",
    "mensalidade_em_dia", "genero", "bolsista", "idade_matricula",
    "internacional", "ucs_1sem_creditadas", "ucs_1sem_matriculadas",
    "ucs_1sem_avaliacoes", "ucs_1sem_aprovadas", "ucs_1sem_nota",
    "ucs_1sem_sem_aval", "ucs_2sem_creditadas", "ucs_2sem_matriculadas",
    "ucs_2sem_avaliacoes", "ucs_2sem_aprovadas", "ucs_2sem_nota",
    "ucs_2sem_sem_aval", "desemprego", "inflacao", "pib",
)

CLASSES = ("Dropout", "Enrolled", "Graduate")

# Códigos categóricos do CSV externo. A API acadêmica ainda precisa mapear
# seus próprios cadastros para esses códigos antes de habilitar inferência real.
CATEGORICAL = frozenset({
    "estado_civil", "modo_candidatura", "curso", "periodo_aula",
    "qualif_anterior", "nacionalidade", "qualif_mae", "qualif_pai",
    "ocupacao_mae", "ocupacao_pai", "deslocado", "necessidades_especiais",
    "devedor", "mensalidade_em_dia", "genero", "bolsista", "internacional",
})
