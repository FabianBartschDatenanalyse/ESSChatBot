/**
 * Utility routines for ordinary least squares regression statistics.
 *
 * These helpers intentionally avoid external numeric libraries so that the
 * statistics tool can run in constrained environments (e.g., serverless) while
 * still providing rich output such as p-values, confidence intervals, and model
 * diagnostics.
 */

export type DesignMatrixBuildResult = {
  design: number[][];
  featureNames: string[];
};

export type OlsCoefficientSummary = {
  term: string;
  coefficient: number;
  standardError: number | null;
  tValue: number | null;
  pValue: number | null;
  significance: string | null;
  confidenceInterval: {
    lower: number | null;
    upper: number | null;
    level: number;
  };
};

export type OlsModelSummary = {
  observations: number;
  features: number;
  dfModel: number;
  dfResidual: number;
  dfTotal: number;
  rSquared: number | null;
  adjustedRSquared: number | null;
  rmse: number | null;
  sigma: number | null;
  logLikelihood: number | null;
  aic: number | null;
  bic: number | null;
  fStatistic: number | null;
  fPValue: number | null;
};

export type OlsComputationResult = {
  coefficients: number[];
  intercept: number;
  fitted: number[];
  residuals: number[];
  xtxInverse: number[][];
  sse: number;
  sst: number;
  dfModel: number;
  dfResidual: number;
  dfTotal: number;
};

export type OlsStatistics = {
  model: OlsModelSummary;
  coefficients: OlsCoefficientSummary[];
  fitted: number[];
  residuals: number[];
  responseMean: number;
  sse: number;
  sst: number;
};

const LANCZOS_COEFFICIENTS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.934937113930748e-6,
  1.659470187408462e-7,
];

const EPS = 1e-12;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const mean = (values: number[]) =>
  values.reduce((acc, v) => acc + v, 0) / values.length;

const sumOfSquares = (values: number[]) =>
  values.reduce((acc, v) => acc + v * v, 0);

const sumProduct = (a: number[], b: number[]) =>
  a.reduce((acc, v, idx) => acc + v * b[idx], 0);

export const buildDesignMatrix = (
  rows: Record<string, number>[],
  featureNames: string[],
): DesignMatrixBuildResult => {
  const design = rows.map((row) => {
    const features = featureNames.map((name) => row[name]);
    return [1, ...features];
  });

  return {
    design,
    featureNames: ['Intercept', ...featureNames],
  };
};

const cloneMatrix = (matrix: number[][]): number[][] =>
  matrix.map((row) => [...row]);

const identityMatrix = (size: number): number[][] => {
  const identity: number[][] = [];
  for (let i = 0; i < size; i++) {
    identity[i] = new Array(size).fill(0);
    identity[i][i] = 1;
  }
  return identity;
};

const matrixMultiply = (a: number[][], b: number[][]): number[][] => {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(0),
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[r][k] * b[k][c];
      }
      result[r][c] = sum;
    }
  }
  return result;
};

const matrixVectorMultiply = (matrix: number[][], vector: number[]): number[] => {
  return matrix.map((row) => sumProduct(row, vector));
};

const transpose = (matrix: number[][]): number[][] =>
  matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));

const invertMatrix = (matrix: number[][]): number[][] | null => {
  const n = matrix.length;
  const augmented = cloneMatrix(matrix);
  const identity = identityMatrix(n);

  for (let i = 0; i < n; i++) {
    let pivot = augmented[i][i];

    if (Math.abs(pivot) < EPS) {
      let found = false;
      for (let row = i + 1; row < n; row++) {
        if (Math.abs(augmented[row][i]) > EPS) {
          [augmented[i], augmented[row]] = [augmented[row], augmented[i]];
          [identity[i], identity[row]] = [identity[row], identity[i]];
          pivot = augmented[i][i];
          found = true;
          break;
        }
      }
      if (!found) {
        return null;
      }
    }

    const pivotInverse = 1 / pivot;
    for (let col = 0; col < n; col++) {
      augmented[i][col] *= pivotInverse;
      identity[i][col] *= pivotInverse;
    }

    for (let row = 0; row < n; row++) {
      if (row === i) continue;
      const factor = augmented[row][i];
      if (Math.abs(factor) < EPS) continue;
      for (let col = 0; col < n; col++) {
        augmented[row][col] -= factor * augmented[i][col];
        identity[row][col] -= factor * identity[i][col];
      }
    }
  }

  return identity;
};

const logGamma = (z: number): number => {
  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = LANCZOS_COEFFICIENTS[0];
  for (let i = 1; i < LANCZOS_COEFFICIENTS.length; i++) {
    x += LANCZOS_COEFFICIENTS[i] / (z + i);
  }
  const t = z + LANCZOS_COEFFICIENTS.length - 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
};

const betacf = (x: number, a: number, b: number): number => {
  const MAX_ITER = 200;
  const FPMIN = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1, m2 = 2; m <= MAX_ITER; m++, m2 += 2) {
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }

  return h;
};

const regularizedIncompleteBeta = (x: number, a: number, b: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta);

  if (x < (a + 1) / (a + b + 2)) {
    return front * betacf(x, a, b) / a;
  } else {
    return 1 - (front * betacf(1 - x, b, a)) / b;
  }
};

export const studentsTCdf = (t: number, df: number): number => {
  const x = df / (df + t * t);
  const ib = regularizedIncompleteBeta(x, df / 2, 0.5);
  if (t >= 0) {
    return 1 - 0.5 * ib;
  }
  return 0.5 * ib;
};

export const studentsTQuantile = (prob: number, df: number): number => {
  const target = clamp(prob, EPS, 1 - EPS);
  const upperTail = target > 0.5;
  const adjustedProb = upperTail ? target : 1 - target;
  let low = 0;
  let high = 1;

  while (studentsTCdf(high, df) < adjustedProb) {
    high *= 2;
    if (high > 1e6) break;
  }

  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const cdf = studentsTCdf(mid, df);
    if (Math.abs(cdf - adjustedProb) < 1e-8) {
      return upperTail ? mid : -mid;
    }
    if (cdf < adjustedProb) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const approx = (low + high) / 2;
  return upperTail ? approx : -approx;
};

const fDistributionPValue = (f: number, df1: number, df2: number): number => {
  if (f <= 0) return 1;
  const x = (df1 * f) / (df1 * f + df2);
  return 1 - regularizedIncompleteBeta(x, df1 / 2, df2 / 2);
};

export const determineSignificance = (pValue: number | null): string | null => {
  if (pValue === null || Number.isNaN(pValue)) return null;
  if (pValue < 0.001) return '***';
  if (pValue < 0.01) return '**';
  if (pValue < 0.05) return '*';
  if (pValue < 0.1) return '•';
  return null;
};

const computeCoefficients = (
  design: number[][],
  response: number[],
): OlsComputationResult | null => {
  const xt = transpose(design);
  const xtx = matrixMultiply(xt, design);
  const xtxInverse = invertMatrix(xtx);
  if (!xtxInverse) return null;
  const xty = matrixVectorMultiply(xt, response);
  const beta = matrixVectorMultiply(xtxInverse, xty);
  const fitted = design.map((row) => sumProduct(row, beta));
  const residuals = response.map((val, idx) => val - fitted[idx]);
  const n = response.length;
  const p = design[0].length - 1;
  const dfModel = p;
  const dfResidual = n - (p + 1);
  const dfTotal = n - 1;
  const yMean = mean(response);
  const sse = sumOfSquares(residuals);
  const centered = response.map((val) => val - yMean);
  const sst = sumOfSquares(centered);

  return {
    coefficients: beta.slice(1),
    intercept: beta[0],
    fitted,
    residuals,
    xtxInverse,
    sse,
    sst,
    dfModel,
    dfResidual,
    dfTotal,
  };
};

export const computeOlsStatistics = (
  design: number[][],
  response: number[],
  featureNames: string[],
  confidenceLevel = 0.95,
): OlsStatistics | null => {
  if (!design.length) return null;
  if (design.length !== response.length) return null;

  const computation = computeCoefficients(design, response);
  if (!computation) return null;

  const {
    coefficients,
    intercept,
    fitted,
    residuals,
    xtxInverse,
    sse,
    sst,
    dfModel,
    dfResidual,
    dfTotal,
  } = computation;

  const n = response.length;
  const p = design[0].length - 1;

  const mse = dfResidual > 0 ? sse / dfResidual : null;
  const sigma = mse !== null ? Math.sqrt(mse) : null;
  const rmse = sigma;

  const rSquared = sst > 0 ? 1 - sse / sst : null;
  const adjustedRSquared =
    rSquared !== null && dfResidual > 0
      ? 1 - (1 - rSquared) * (dfTotal) / Math.max(dfResidual, 1)
      : null;

  const logLikelihood =
    mse !== null && mse > 0
      ? (-n / 2) * (Math.log(2 * Math.PI) + 1 + Math.log(mse))
      : null;

  const k = p + 1;
  const aic =
    logLikelihood !== null ? -2 * logLikelihood + 2 * k : null;
  const bic =
    logLikelihood !== null ? -2 * logLikelihood + Math.log(n) * k : null;

  const ssr = rSquared !== null ? sst * rSquared : null;
  const msModel = ssr !== null && dfModel > 0 ? ssr / dfModel : null;
  const msError = mse;
  const fStatistic =
    msModel !== null && msError !== null && msError > 0 && dfModel > 0
      ? msModel / msError
      : null;

  const fPValue =
    fStatistic !== null && dfModel > 0 && dfResidual > 0
      ? fDistributionPValue(fStatistic, dfModel, dfResidual)
      : null;

  const standardErrors: (number | null)[] = [];
  const tValues: (number | null)[] = [];
  const pValues: (number | null)[] = [];
  const coefficientTerms = [intercept, ...coefficients];
  const tCritical =
    dfResidual > 0 ? Math.abs(studentsTQuantile(1 - (1 - confidenceLevel) / 2, dfResidual)) : null;

  const coefficientSummaries: OlsCoefficientSummary[] = coefficientTerms.map(
    (coefficient, index) => {
      const variance =
        mse !== null ? mse * xtxInverse[index][index] : null;
      const stdError =
        variance !== null && variance > 0 ? Math.sqrt(variance) : null;
      const tValue =
        stdError !== null && stdError > 0 ? coefficient / stdError : null;
      const pValue =
        tValue !== null && dfResidual > 0
          ? 2 * (1 - studentsTCdf(Math.abs(tValue), dfResidual))
          : null;
      const significance = determineSignificance(pValue);
      const intervalRadius =
        tCritical !== null && stdError !== null ? tCritical * stdError : null;

      standardErrors.push(stdError);
      tValues.push(tValue);
      pValues.push(pValue);

      return {
        term: featureNames[index] ?? `x${index}`,
        coefficient,
        standardError: stdError,
        tValue,
        pValue,
        significance,
        confidenceInterval: {
          lower:
            intervalRadius !== null ? coefficient - intervalRadius : null,
          upper:
            intervalRadius !== null ? coefficient + intervalRadius : null,
          level: confidenceLevel,
        },
      };
    },
  );

  return {
    model: {
      observations: n,
      features: p,
      dfModel,
      dfResidual,
      dfTotal,
      rSquared,
      adjustedRSquared,
      rmse,
      sigma,
      logLikelihood,
      aic,
      bic,
      fStatistic,
      fPValue,
    },
    coefficients: coefficientSummaries,
    fitted: computation.fitted,
    residuals: computation.residuals,
    responseMean: mean(response),
    sse,
    sst,
  };
};
