"""Lightweight, dependency-free backend analytics for SAT-SA.

The frontend already contains the full analytics implementation.
The backend keeps the Isolation Forest endpoint without importing
pandas, NumPy, SciPy, or scikit-learn.
"""

from __future__ import annotations

import math
import random
from typing import Any, Dict, List, Optional


def _c(n: int) -> float:
    """Average path-length adjustment used by Isolation Forest."""
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0

    euler_gamma = 0.5772156649
    return 2.0 * (math.log(n - 1) + euler_gamma) - (
        2.0 * (n - 1) / n
    )


class _Node:
    __slots__ = ("feature", "split", "left", "right", "size")

    def __init__(
        self,
        feature: int = -1,
        split: float = 0.0,
        left: Optional["_Node"] = None,
        right: Optional["_Node"] = None,
        size: int = 0,
    ) -> None:
        self.feature = feature
        self.split = split
        self.left = left
        self.right = right
        self.size = size


def _build_tree(
    rows: List[List[float]],
    max_depth: int,
    rng: random.Random,
    depth: int = 0,
) -> _Node:

    size = len(rows)

    if size <= 1 or depth >= max_depth:
        return _Node(size=size)

    width = len(rows[0]) if rows and rows[0] else 0

    if width == 0:
        return _Node(size=size)

    feature = rng.randrange(width)

    values = [row[feature] for row in rows]

    lo = min(values)
    hi = max(values)

    if lo == hi:
        return _Node(size=size)

    split = lo + rng.random() * (hi - lo)

    left_rows = [
        row for row in rows
        if row[feature] < split
    ]

    right_rows = [
        row for row in rows
        if row[feature] >= split
    ]

    if not left_rows or not right_rows:
        return _Node(size=size)

    return _Node(
        feature=feature,
        split=split,
        left=_build_tree(
            left_rows,
            max_depth,
            rng,
            depth + 1,
        ),
        right=_build_tree(
            right_rows,
            max_depth,
            rng,
            depth + 1,
        ),
        size=size,
    )


def _path_length(
    row: List[float],
    node: Optional[_Node],
    depth: int = 0,
) -> float:

    if node is None:
        return float(depth)

    if (
        node.left is None
        or node.right is None
        or node.feature < 0
    ):
        return depth + _c(node.size)

    if row[node.feature] < node.split:
        return _path_length(
            row,
            node.left,
            depth + 1,
        )

    return _path_length(
        row,
        node.right,
        depth + 1,
    )


def run_multivariate_isolation_forest(
    feature_matrix: List[List[float]],
    contamination: float = 0.1,
) -> Dict[str, Any]:

    if not feature_matrix:
        return {
            "anomaly_scores": [],
            "predictions": [],
            "anomalies_detected": 0,
        }

    rows: List[List[float]] = []

    width = (
        len(feature_matrix[0])
        if feature_matrix and feature_matrix[0]
        else 0
    )

    for row in feature_matrix:

        if len(row) != width:
            raise ValueError(
                "All feature vectors must have the same length."
            )

        clean = [float(v) for v in row]

        if not all(math.isfinite(v) for v in clean):
            raise ValueError(
                "Feature values must be finite numbers."
            )

        rows.append(clean)

    n = len(rows)

    if n == 1:
        return {
            "anomaly_scores": [0.0],
            "predictions": [1],
            "anomalies_detected": 0,
        }

    contamination = min(
        max(float(contamination), 0.01),
        0.5,
    )

    num_trees = 100
    subsample_size = min(256, n)

    max_depth = math.ceil(
        math.log2(max(subsample_size, 2))
    )

    normalizer = _c(subsample_size) or 1.0

    rng = random.Random(42)

    trees: List[_Node] = []
    indices = list(range(n))

    for _ in range(num_trees):

        if subsample_size == n:
            sample_indices = indices.copy()
        else:
            sample_indices = rng.sample(
                indices,
                subsample_size,
            )

        sample = [
            rows[i]
            for i in sample_indices
        ]

        trees.append(
            _build_tree(
                sample,
                max_depth,
                rng,
            )
        )

    raw_scores: List[float] = []

    for row in rows:

        avg_path = (
            sum(
                _path_length(row, tree)
                for tree in trees
            )
            / len(trees)
        )

        score = 2.0 ** (
            -avg_path / normalizer
        )

        raw_scores.append(score)

    ordered = sorted(
        enumerate(raw_scores),
        key=lambda item: item[1],
        reverse=True,
    )

    cutoff_index = max(
        1,
        math.floor(n * contamination),
    )

    threshold = ordered[
        min(cutoff_index - 1, n - 1)
    ][1]

    predictions = [
        1
        if score < threshold or score < 0.55
        else -1
        for score in raw_scores
    ]

    anomaly_scores = [
        round(score, 4)
        for score in raw_scores
    ]

    return {
        "anomaly_scores": anomaly_scores,
        "predictions": predictions,
        "anomalies_detected": int(
            sum(
                prediction == -1
                for prediction in predictions
            )
        ),
    }


def calculate_robust_statistics(
    values: List[float],
) -> Dict[str, float]:

    if not values:
        return {
            "median": 0.0,
            "iqr": 0.0,
            "mad": 0.0,
        }

    arr = sorted(
        float(v)
        for v in values
    )

    def median(seq: List[float]) -> float:

        m = len(seq)
        mid = m // 2

        if m % 2:
            return seq[mid]

        return (
            seq[mid - 1]
            + seq[mid]
        ) / 2.0

    def percentile(
        seq: List[float],
        p: float,
    ) -> float:

        if len(seq) == 1:
            return seq[0]

        position = (len(seq) - 1) * p

        low = int(math.floor(position))
        high = int(math.ceil(position))

        if low == high:
            return seq[low]

        fraction = position - low

        return (
            seq[low]
            + (seq[high] - seq[low])
            * fraction
        )

    med = median(arr)

    q75 = percentile(arr, 0.75)
    q25 = percentile(arr, 0.25)

    deviations = sorted(
        abs(v - med)
        for v in arr
    )

    mad = median(deviations)

    return {
        "median": round(med, 2),
        "iqr": round(q75 - q25, 2),
        "mad": round(mad, 2),
    }