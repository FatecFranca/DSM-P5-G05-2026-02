import { type DemoStudent, type PredictionClass, riskLevel } from './data.ts';

export const gradeBins = [
  { label: '0–2', min: 0, max: 2 },
  { label: '2–4', min: 2, max: 4 },
  { label: '4–6', min: 4, max: 6 },
  { label: '6–8', min: 6, max: 8 },
  { label: '8–10', min: 8, max: 10.01 },
] as const;

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function describeStudents(students: DemoStudent[]) {
  const grades = students.map((student) => student.academicAverage);
  const riskCounts = { Baixo: 0, Médio: 0, Alto: 0 };
  const classCounts: Record<PredictionClass, number> = { Dropout: 0, Enrolled: 0, Graduate: 0 };
  for (const student of students) {
    riskCounts[riskLevel(student.prediction.probabilities.Dropout)]++;
    classCounts[student.prediction.class]++;
  }
  return {
    count: students.length,
    meanGrade: mean(grades),
    medianGrade: median(grades),
    meanAttendance: mean(students.map((student) => student.attendance)),
    riskCounts,
    classCounts,
    histogram: gradeBins.map((bin) => grades.filter((grade) => grade >= bin.min && grade < bin.max).length),
  };
}

export function evaluateConfusionMatrix(matrix: readonly (readonly number[])[]) {
  const total = matrix.flat().reduce((sum, value) => sum + value, 0);
  const classes = matrix.map((row, index) => {
    const truePositive = row[index];
    const actual = row.reduce((sum, value) => sum + value, 0);
    const predicted = matrix.reduce((sum, current) => sum + current[index], 0);
    const precision = predicted ? truePositive / predicted : 0;
    const recall = actual ? truePositive / actual : 0;
    return {
      support: actual,
      precision,
      recall,
      f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0,
    };
  });
  return {
    total,
    accuracy: total ? matrix.reduce((sum, row, index) => sum + row[index], 0) / total : 0,
    macroF1: mean(classes.map((item) => item.f1)) ?? 0,
    balancedAccuracy: mean(classes.map((item) => item.recall)) ?? 0,
    classes,
  };
}
