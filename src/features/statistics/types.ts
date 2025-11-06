import { z } from 'zod';

const numericNullable = z.number().nullable();

export const RegressionConfidenceIntervalSchema = z.object({
  lower: numericNullable,
  upper: numericNullable,
  level: z.number(),
});

export const RegressionCoefficientSchema = z.object({
  term: z.string(),
  coefficient: z.number(),
  standardError: numericNullable,
  tValue: numericNullable,
  pValue: numericNullable,
  significance: z.string().nullable(),
  confidenceInterval: RegressionConfidenceIntervalSchema,
});

export const RegressionSummaryStatisticsSchema = z.object({
  min: numericNullable,
  max: numericNullable,
  mean: numericNullable,
  stdDev: numericNullable,
});

export const RegressionResidualSummarySchema = RegressionSummaryStatisticsSchema.extend({
  sse: z.number(),
});

export const RegressionDiagnosticsSchema = z.object({
  residuals: RegressionResidualSummarySchema,
  fitted: RegressionSummaryStatisticsSchema,
  sst: z.number(),
  responseMean: z.number(),
  confidenceLevel: z.number(),
});

export const RegressionModelSummarySchema = z.object({
  observations: z.number(),
  features: z.number(),
  dfModel: z.number(),
  dfResidual: z.number(),
  dfTotal: z.number(),
  rSquared: numericNullable,
  adjustedRSquared: numericNullable,
  rmse: numericNullable,
  sigma: numericNullable,
  logLikelihood: numericNullable,
  aic: numericNullable,
  bic: numericNullable,
  fStatistic: numericNullable,
  fPValue: numericNullable,
});

export const LinearRegressionAnalysisSchema = z.object({
  model: z.literal('Linear Regression'),
  target: z.string(),
  predictors: z.array(z.string()),
  observations: z.number(),
  intercept: z.number(),
  coefficientsByTerm: z.record(z.number()),
  coefficientTable: z.array(RegressionCoefficientSchema),
  modelSummary: RegressionModelSummarySchema,
  diagnostics: RegressionDiagnosticsSchema,
  featureEngineering: z.array(z.string()),
});

export const RandomForestRegressionAnalysisSchema = z.object({
  model: z.literal('Random Forest Regression'),
  target: z.string(),
  predictors: z.array(z.string()),
  observations: z.number(),
  message: z.string().optional(),
  featureEngineering: z.array(z.string()).optional(),
});

export const TTestGroupSummarySchema = z.object({
  groupValue: z.string(),
  n: z.number(),
  mean: z.number(),
  stdDev: numericNullable,
  standardError: numericNullable,
});

export const TTestDifferenceSchema = z.object({
  referenceGroup: z.string(),
  comparisonGroup: z.string(),
  meanDifference: z.number(),
  standardError: z.number(),
  degreesOfFreedom: z.number(),
  tStatistic: z.number(),
  pValue: numericNullable,
  significance: z.string().nullable(),
  confidenceInterval: RegressionConfidenceIntervalSchema,
});

export const TTestEffectSizeSchema = z.object({
  cohensD: numericNullable,
  hedgesG: numericNullable,
});

export const IndependentTTestAnalysisSchema = z.object({
  model: z.literal('Independent Samples t-Test'),
  target: z.string(),
  groupingVariable: z.string(),
  groups: z.array(TTestGroupSummarySchema),
  difference: TTestDifferenceSchema,
  effectSize: TTestEffectSizeSchema,
  assumptions: z.array(z.string()),
});

export const RegressionAnalysisSchema = z.union([
  LinearRegressionAnalysisSchema,
  RandomForestRegressionAnalysisSchema,
]);

export const StatisticsAnalysisSchema = z.union([
  LinearRegressionAnalysisSchema,
  RandomForestRegressionAnalysisSchema,
  IndependentTTestAnalysisSchema,
]);

export type RegressionAnalysis = z.infer<typeof RegressionAnalysisSchema>;
export type LinearRegressionAnalysis = z.infer<typeof LinearRegressionAnalysisSchema>;
export type RandomForestRegressionAnalysis = z.infer<typeof RandomForestRegressionAnalysisSchema>;
export type IndependentTTestAnalysis = z.infer<typeof IndependentTTestAnalysisSchema>;
export type StatisticsAnalysis = z.infer<typeof StatisticsAnalysisSchema>;
