export const demoLabel = 'Dados fictícios — demonstração';
export const classNames = ['ADS 2026.1', 'ADS 2026.2', 'DSM 2026.1', 'DSM 2026.2'] as const;
export type PredictionClass = 'Dropout' | 'Enrolled' | 'Graduate';
export type RiskLevel = 'Baixo' | 'Médio' | 'Alto';
export const predictionLabel: Record<PredictionClass, string> = {
  Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Concluiu',
};

export interface DemoStudent {
  id: string;
  name: string;
  registration: string;
  classId: string;
  academicAverage: number;
  attendance: number;
  completedCredits: number;
  prediction: {
    class: PredictionClass;
    probabilities: Record<PredictionClass, number>;
    modelVersion: 'demo-1.0';
    isMock: true;
  };
}

export const demoClasses = classNames.map((name, index) => ({
  id: `class-demo-${String(index + 1).padStart(3, '0')}`,
  name,
  course: name.slice(0, 3),
  semester: name.slice(4),
}));

const firstNames = ['Ana Beatriz', 'Bruno', 'Camila', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João'];
const lastNames = ['Oliveira', 'Santos', 'Almeida', 'Costa'];

export const demoStudents: DemoStudent[] = Array.from({ length: 40 }, (_, index) => {
  const dropout = (8 + (index * 17) % 76) / 100;
  const enrolled = Math.round((1 - dropout) * (0.35 + (index % 3) * 0.1) * 100) / 100;
  const graduate = Math.round((1 - dropout - enrolled) * 100) / 100;
  const probabilities = { Dropout: dropout, Enrolled: enrolled, Graduate: graduate };
  const predicted = (Object.keys(probabilities) as PredictionClass[]).reduce((best, candidate) =>
    probabilities[candidate] > probabilities[best] ? candidate : best,
  );
  return {
    id: `student-demo-${String(index + 1).padStart(3, '0')}`,
    name: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`,
    registration: String(2026001 + index),
    classId: demoClasses[index % demoClasses.length].id,
    academicAverage: Math.round((4.5 + ((index * 13) % 50) / 10) * 10) / 10,
    attendance: 65 + (index * 7) % 36,
    completedCredits: 24 + (index * 13) % 140,
    prediction: { class: predicted, probabilities, modelVersion: 'demo-1.0', isMock: true },
  };
});

export function riskLevel(probability: number): RiskLevel {
  if (probability >= 0.65) return 'Alto';
  if (probability >= 0.35) return 'Médio';
  return 'Baixo';
}

export function summarize(students: DemoStudent[]) {
  const count = students.length;
  const distributions = { Dropout: 0, Enrolled: 0, Graduate: 0 };
  for (const student of students) distributions[student.prediction.class]++;
  return {
    count,
    academicAverage: count ? students.reduce((sum, student) => sum + student.academicAverage, 0) / count : null,
    highRiskCount: students.filter((student) => riskLevel(student.prediction.probabilities.Dropout) === 'Alto').length,
    distributions,
  };
}

export function studentsInClass(classId: string) {
  return demoStudents.filter((student) => student.classId === classId);
}

export const demoModelMetrics = {
  name: 'Classificador demonstrativo',
  version: 'demo-1.0',
  confusionMatrix: [[8, 2, 0], [1, 7, 2], [0, 2, 8]],
} as const;
