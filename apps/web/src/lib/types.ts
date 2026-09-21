/**
 * CBE Manager — shared domain types.
 * This file is the frozen API contract between the frontend and the future
 * backend. The backend must implement against these exact shapes.
 */

export type Role =
  | "SUPER_ADMIN"
  | "COUNTY_ADMIN"
  | "SUB_COUNTY_ADMIN"
  | "SCHOOL_ADMIN"
  | "TEACHER";

export type GradeCode =
  | "PP1"
  | "PP2"
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "G5"
  | "G6"
  | "G7"
  | "G8"
  | "G9";

export type TermNumber = 1 | 2 | 3;

export interface Term {
  year: number;
  term: TermNumber;
}

export type SchoolType = "PRIMARY" | "JUNIOR_SECONDARY";

export interface County {
  id: string;
  code: string;
  name: string;
}

export interface SubCounty {
  id: string;
  countyId: string;
  name: string;
}

export interface School {
  id: string;
  code: string; // NEMIS-style code
  name: string;
  type: SchoolType;
  countyId: string;
  subCountyId: string;
  address?: string;
  phone?: string;
  enrollmentCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolIds: string[];
  countyIds: string[];
  active: boolean;
}

export type Gender = "M" | "F";

export interface Learner {
  id: string;
  upi: string; // Unique Personal Identifier
  nemis?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: Gender;
  dob: string; // ISO date
  schoolId: string;
  classId?: string; // active class
  guardianName?: string;
  guardianPhone?: string;
  admissionYear: number;
}

export interface LearnerInput {
  upi?: string;
  nemis?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: Gender;
  dob: string;
  guardianName?: string;
  guardianPhone?: string;
  admissionYear: number;
}

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "TRANSFERRED";

export interface Enrollment {
  id: string;
  learnerId: string;
  classId: string;
  year: number;
  term: TermNumber;
  status: EnrollmentStatus;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  grade: GradeCode;
  stream: string;
  teacherId?: string;
  learnerCount?: number;
}

export interface LearningArea {
  id: string;
  code: string;
  name: string;
  grades: GradeCode[];
}

export interface Strand {
  id: string;
  learningAreaId: string;
  code: string;
  name: string;
  grades: GradeCode[];
}

export interface SubStrand {
  id: string;
  strandId: string;
  code: string;
  name: string;
  grade: GradeCode;
}

export interface StrandNode extends Strand {
  subStrands: SubStrand[];
}

export interface LearningAreaNode extends LearningArea {
  strands: StrandNode[];
}

export type CompetencyLevel = "EE" | "ME" | "AE" | "BE";

export interface LevelDefinition {
  level: CompetencyLevel;
  /** Minimum raw score (inclusive), score scale 0-10 */
  min: number;
  label: string;
  description: string;
}

export interface ScoreRow {
  id: string;
  term: Term;
  learnerId: string;
  subStrandId: string;
  score: number | null;
}

export interface ScoreInput {
  term: Term;
  learnerId: string;
  subStrandId: string;
  score: number | null;
}

export interface ScoreGridRow {
  learner: Pick<Learner, "id" | "upi" | "firstName" | "middleName" | "lastName">;
  cells: Record<string, number | null>; // subStrandId -> score
}

export interface CommentEntry {
  id: string;
  term: Term;
  learnerId: string;
  teacherComment?: string;
  headComment?: string;
  nextTermFocus?: string;
}

export interface CommentFormInput {
  teacherComment?: string;
  headComment?: string;
  nextTermFocus?: string;
}

export interface ReportArea {
  learningAreaId: string;
  name: string;
  averageScore: number;
  level: CompetencyLevel;
}

export interface ReportCardData {
  school: School;
  learner: Learner;
  term: Term;
  grade: GradeCode;
  stream: string;
  areas: ReportArea[];
  overall: {
    averageScore: number;
    level: CompetencyLevel;
    totalLearners: number;
  };
  teacherComment?: string;
  headComment?: string;
  nextTermFocus?: string;
  issuedAt: string;
}

export interface EnrollmentByGrade {
  grade: GradeCode;
  count: number;
}

export interface LevelDistribution {
  level: CompetencyLevel;
  count: number;
}

export interface DashboardStats {
  year: number;
  term: TermNumber;
  totalLearners: number;
  totalClasses: number;
  totalLearningAreas: number;
  avgPerformance: number;
  enrollmentByGrade: EnrollmentByGrade[];
  levelDistribution: LevelDistribution[];
  weakestAreas: ReportArea[];
}