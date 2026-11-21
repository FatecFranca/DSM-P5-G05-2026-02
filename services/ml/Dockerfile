FROM python:3.12-alpine3.24 AS base
RUN apk upgrade --no-cache \
    && apk add --no-cache libstdc++ libgomp

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

FROM base AS build
RUN apk add --no-cache build-base
COPY requirements.txt ./
# O scikit-learn 1.8.0 precisa ser compilado para musl; os compiladores ficam fora do runtime.
RUN pip wheel --no-cache-dir --no-deps --wheel-dir=/wheels \
    --config-settings=compile-args=-j2 "$(grep '^scikit-learn==' requirements.txt)" \
    && pip wheel --no-cache-dir --only-binary=:all: --find-links=/wheels \
    --wheel-dir=/wheels -r requirements.txt

FROM base AS production
COPY requirements.txt ./
RUN --mount=type=bind,from=build,source=/wheels,target=/wheels \
    pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && addgroup -S -g 10001 ml \
    && adduser -S -D -u 10001 -G ml ml
COPY --chown=ml:ml app ./app
COPY --chown=ml:ml candidates ./candidates
COPY --chown=ml:ml artifacts/externo-lr-sem-enrolled-v1/model.pkl /models/externo-lr-sem-enrolled-v1/model.pkl
USER 10001

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
