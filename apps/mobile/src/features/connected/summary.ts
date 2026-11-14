import { gradeBins, mean, median } from '../../demo/statistics.ts';

export interface EnrollmentView {
  id: string;
  userId: string;
  name: string;
  registration: string;
  classId: string;
  className: string;
  course: string;
  average: number | null;
  attendance: number | null;
}

export function summarizeEnrollments(items: EnrollmentView[]) {
  const grades = items.flatMap((item) => item.average === null ? [] : [item.average]);
  const attendance = items.flatMap((item) => item.attendance === null ? [] : [item.attendance]);
  return {
    count: items.length,
    graded: grades.length,
    attendanceRecorded: attendance.length,
    meanGrade: mean(grades),
    medianGrade: median(grades),
    meanAttendance: mean(attendance),
    histogram: gradeBins.map((bin) => grades.filter((grade) => grade >= bin.min && grade < bin.max).length),
  };
}
