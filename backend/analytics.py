import pandas as pd
import numpy as np
from scipy import stats
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, List

def run_multivariate_isolation_forest(feature_matrix: List[List[float]], contamination: float = 0.1) -> Dict[str, Any]:
    """
    Executes Scikit-Learn IsolationForest on feature vectors.
    """
    X = np.array(feature_matrix)
    if len(X) < 2:
        return {"anomaly_scores": [0.0], "predictions": [1], "anomalies_detected": 0}

    clf = IsolationForest(n_estimators=100, contamination=contamination, random_state=42)
    clf.fit(X)

    # decision_function gives negative anomaly score (lower is more anomalous)
    raw_scores = clf.decision_function(X)
    preds = clf.predict(X)  # -1 for anomaly, 1 for inlier

    # Normalize scores to 0-1
    normalized_scores = (1.0 - (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-9)).tolist()

    return {
        "anomaly_scores": [round(s, 4) for s in normalized_scores],
        "predictions": preds.tolist(),
        "anomalies_detected": int(sum(preds == -1))
    }

def calculate_robust_statistics(values: List[float]) -> Dict[str, float]:
    """
    Calculates median, IQR, and Median Absolute Deviation (MAD) using SciPy and NumPy.
    """
    arr = np.array(values)
    if len(arr) == 0:
        return {"median": 0.0, "iqr": 0.0, "mad": 0.0}

    med = float(np.median(arr))
    q75, q25 = np.percentile(arr, [75, 25])
    iqr = float(q75 - q25)
    mad = float(stats.median_abs_deviation(arr))

    return {
        "median": round(med, 2),
        "iqr": round(iqr, 2),
        "mad": round(mad, 2)
    }
