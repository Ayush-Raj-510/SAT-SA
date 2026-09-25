/**
 * Machine Learning & Anomaly Discovery: Isolation Forest
 * Equivalent to scikit-learn's ensemble.IsolationForest
 * 
 * Implements:
 * - IsolationTree (iTree): Random recursive partitioning on multi-dimensional vectors
 * - IsolationForest: Ensemble bagging over sub-sampled training partitions
 * - Path Length & Average Depth Estimation with Euler-Mascheroni constant
 * - Contamination thresholding & Anomaly Score calculation s(x, n) = 2^(-E(h(x))/c(n))
 */

export interface DataPoint {
  id: string;
  label: string;
  features: number[];
  metadata?: Record<string, any>;
}

export interface AnomalyPrediction {
  id: string;
  label: string;
  anomalyScore: number; // 0 to 1 (scores > 0.6 indicate significant anomalies)
  isAnomaly: boolean;
  averagePathLength: number;
  expectedPathLength: number;
  rawScore: number;
  metadata?: Record<string, any>;
}

class IsolationTreeNode {
  splitFeature: number = -1;
  splitValue: number = 0;
  left: IsolationTreeNode | null = null;
  right: IsolationTreeNode | null = null;
  size: number = 0;
  isLeaf: boolean = false;

  constructor(isLeaf = false, size = 0) {
    this.isLeaf = isLeaf;
    this.size = size;
  }
}

// Harmonic number approximation using Euler-Mascheroni constant (gamma ≈ 0.5772156649)
function c(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 1;
  const eulerGamma = 0.5772156649;
  return 2 * (Math.log(n - 1) + eulerGamma) - (2 * (n - 1)) / n;
}

export class IsolationTree {
  root: IsolationTreeNode | null = null;
  maxHeight: number;

  constructor(maxHeight: number) {
    this.maxHeight = maxHeight;
  }

  fit(data: number[][], currentHeight = 0): IsolationTreeNode {
    const numSamples = data.length;
    if (currentHeight >= this.maxHeight || numSamples <= 1) {
      return new IsolationTreeNode(true, numSamples);
    }

    const numFeatures = data[0].length;
    // Choose random feature
    const splitFeature = Math.floor(Math.random() * numFeatures);

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < numSamples; i++) {
      const v = data[i][splitFeature];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    if (minVal === maxVal) {
      return new IsolationTreeNode(true, numSamples);
    }

    // Uniform random split value between min and max
    const splitValue = minVal + Math.random() * (maxVal - minVal);

    const leftData: number[][] = [];
    const rightData: number[][] = [];

    for (let i = 0; i < numSamples; i++) {
      if (data[i][splitFeature] < splitValue) {
        leftData.push(data[i]);
      } else {
        rightData.push(data[i]);
      }
    }

    const node = new IsolationTreeNode(false, numSamples);
    node.splitFeature = splitFeature;
    node.splitValue = splitValue;
    node.left = this.fit(leftData, currentHeight + 1);
    node.right = this.fit(rightData, currentHeight + 1);
    return node;
  }

  computePathLength(x: number[], node: IsolationTreeNode | null, currentLength = 0): number {
    if (!node || node.isLeaf) {
      const size = node ? node.size : 1;
      return currentLength + (size > 1 ? c(size) : 0);
    }

    if (x[node.splitFeature] < node.splitValue) {
      return this.computePathLength(x, node.left, currentLength + 1);
    } else {
      return this.computePathLength(x, node.right, currentLength + 1);
    }
  }
}

export class IsolationForest {
  numTrees: number;
  subsampleSize: number;
  contamination: number;
  trees: IsolationTree[] = [];
  featureNames: string[] = [];

  constructor(options?: { numTrees?: number; subsampleSize?: number; contamination?: number; featureNames?: string[] }) {
    this.numTrees = options?.numTrees ?? 100;
    this.subsampleSize = options?.subsampleSize ?? 256;
    this.contamination = options?.contamination ?? 0.1; // top 10% suspected outliers
    this.featureNames = options?.featureNames ?? [];
  }

  fit(dataPoints: DataPoint[]) {
    if (!dataPoints.length) return;
    const n = dataPoints.length;
    const subSize = Math.min(this.subsampleSize, n);
    const maxHeight = Math.ceil(Math.log2(Math.max(subSize, 2)));

    this.trees = [];

    for (let t = 0; t < this.numTrees; t++) {
      // Subsample randomly without replacement
      const sampleIndices = new Set<number>();
      while (sampleIndices.size < subSize) {
        sampleIndices.add(Math.floor(Math.random() * n));
      }

      const subsample: number[][] = Array.from(sampleIndices).map(idx => dataPoints[idx].features);
      const tree = new IsolationTree(maxHeight);
      tree.root = tree.fit(subsample);
      this.trees.push(tree);
    }
  }

  predict(dataPoints: DataPoint[]): AnomalyPrediction[] {
    if (!this.trees.length || !dataPoints.length) return [];

    const n = dataPoints.length;
    const subSize = Math.min(this.subsampleSize, n);
    const cN = c(subSize);

    const results: AnomalyPrediction[] = dataPoints.map(dp => {
      let totalPathLength = 0;
      for (const tree of this.trees) {
        totalPathLength += tree.computePathLength(dp.features, tree.root);
      }
      const avgPathLength = totalPathLength / this.trees.length;

      // Anomaly score: s(x, n) = 2^(-E(h(x)) / c(n))
      const exponent = -avgPathLength / (cN || 1);
      const anomalyScore = Math.pow(2, exponent);

      return {
        id: dp.id,
        label: dp.label,
        anomalyScore: Number(anomalyScore.toFixed(4)),
        isAnomaly: false, // will mark after sorting
        averagePathLength: Number(avgPathLength.toFixed(2)),
        expectedPathLength: Number(cN.toFixed(2)),
        rawScore: anomalyScore,
        metadata: dp.metadata
      };
    });

    // Mark top contamination quantile as anomalies
    const sorted = [...results].sort((a, b) => b.rawScore - a.rawScore);
    const cutoffIndex = Math.max(1, Math.floor(sorted.length * this.contamination));
    const thresholdScore = sorted[Math.min(cutoffIndex - 1, sorted.length - 1)].rawScore;

    results.forEach(r => {
      r.isAnomaly = r.rawScore >= thresholdScore && r.rawScore >= 0.55;
    });

    return results;
  }
}
