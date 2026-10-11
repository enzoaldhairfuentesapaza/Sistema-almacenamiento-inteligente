from datetime import datetime, timedelta

import numpy as np
from fastapi import HTTPException
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.services.analytics import sales_series


def features(days, origin):
    return np.array(
        [
            [
                (d - origin).days,
                int(d.weekday() >= 5),
                *[(1 if d.weekday() == w else 0) for w in range(7)],
                np.sin(2 * np.pi * d.timetuple().tm_yday / 365.25),
                np.cos(2 * np.pi * d.timetuple().tm_yday / 365.25),
            ]
            for d in days
        ],
        dtype=float,
    )


def predict(kind, days, y, future, origin):
    if kind == "semanal":
        return np.array([y[-7 + (i % 7)] for i in range(len(future))])
    model = make_pipeline(StandardScaler(), Ridge(alpha=10))
    model.fit(features(days, origin), y)
    return np.maximum(0, model.predict(features(future, origin)))


def forecast(db, user, horizon, product_id=None):
    values, zone = sales_series(db, user, product_id)
    end = datetime.now(zone).date() - timedelta(days=1)
    dates = sorted(d for d in values if d <= end)
    if not dates or (end - dates[0]).days < 55:
        raise HTTPException(
            422,
            "Se necesitan al menos 56 días de historial con registro continuo. Aún no hay datos suficientes.",
        )
    start = dates[0]
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    y = np.array([values.get(d, 0) for d in days])
    if not y.sum():
        raise HTTPException(422, "No hay ventas registradas para este pronóstico")
    # Two chronological origins. Each fold trains only on earlier dates.
    metrics = []
    errors = {}
    for kind in ("semanal", "ridge_calendario"):
        residual = []
        observed = []
        for cut in (len(days) - 21, len(days) - 7):
            actual = y[cut : cut + 7]
            pred = predict(kind, days[:cut], y[:cut], days[cut : cut + 7], start)
            residual.extend((actual - pred).tolist())
            observed.extend(actual.tolist())
        err = np.array(residual)
        den = sum(abs(v) for v in observed)
        metrics.append(
            {
                "modelo": kind,
                "mae": round(float(np.abs(err).mean()), 3),
                "wape": round(float(np.abs(err).sum() / den * 100), 2) if den else None,
            }
        )
        errors[kind] = err
    best = min(metrics, key=lambda m: m["mae"])["modelo"]
    future = [end + timedelta(days=i) for i in range(1, horizon + 1)]
    result = predict(best, days, y, future, start)
    band = float(np.quantile(np.abs(errors[best]), 0.9))
    return {
        "modelo": best,
        "objetivo": "unidades_vendidas" if product_id else "importe_de_ventas",
        "dias_historial": len(days),
        "horizonte": horizon,
        "metricas": metrics,
        "advertencia": "Los días sin registro se consideran cero. No estima demanda perdida por falta de stock. Bandas empíricas de error, sin cobertura garantizada.",
        "predicciones": [
            {
                "fecha": d.isoformat(),
                "valor": round(float(v), 2),
                "inferior": round(max(0, float(v) - band), 2),
                "superior": round(float(v) + band, 2),
            }
            for d, v in zip(future, result)
        ],
    }
