import type {
  County,
  SubCounty,
  School,
  User,
  SchoolClass,
  Learner,
  LearningArea,
  Strand,
  SubStrand,
  Enrollment,
  ScoreRow,
  CommentEntry,
  GradeCode,
  Term,
} from "@/lib/types";

/** Deterministic PRNG so seed data is stable across reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const prng = mulberry32(20260901);

/* ------------------------------------------------------------------ */
/* Geography                                                           */
/* ------------------------------------------------------------------ */

export const counties: County[] = [
  { id: "ct-nairobi", code: "47", name: "Nairobi" },
  { id: "ct-kiambu", code: "22", name: "Kiambu" },
  { id: "ct-mombasa", code: "1", name: "Mombasa" },
];

export const subCounties: SubCounty[] = [
  { id: "sc-langata", countyId: "ct-nairobi", name: "Langata" },
  { id: "sc-kasarani", countyId: "ct-nairobi", name: "Kasarani" },
  { id: "sc-ruiru", countyId: "ct-kiambu", name: "Ruiru" },
  { id: "sc-jomvu", countyId: "ct-mombasa", name: "Jomvu" },
];

export const schools: School[] = [
  {
    id: "sch-1",
    code: "14700112034",
    name: "Langata Estate Primary School",
    type: "PRIMARY",
    countyId: "ct-nairobi",
    subCountyId: "sc-langata",
    address: "Langata Road, Nairobi",
    phone: "+254 720 100 100",
  },
  {
    id: "sch-2",
    code: "14700215087",
    name: "Ruiru Township Junior Secondary",
    type: "JUNIOR_SECONDARY",
    countyId: "ct-kiambu",
    subCountyId: "sc-ruiru",
    address: "Ruiru Town, Kiambu",
    phone: "+254 733 200 200",
  },
  {
    id: "sch-3",
    code: "14700316219",
    name: "Kasarani Baptist Primary",
    type: "PRIMARY",
    countyId: "ct-nairobi",
    subCountyId: "sc-kasarani",
    address: "Kasarani, Nairobi",
    phone: "+254 711 300 300",
  },
  {
    id: "sch-4",
    code: "14700417842",
    name: "Jomvu Township Primary School",
    type: "PRIMARY",
    countyId: "ct-mombasa",
    subCountyId: "sc-jomvu",
    address: "Jomvu, Mombasa",
    phone: "+254 724 400 400",
  },
];

export const schoolBySubCounty: Record<string, string[]> = {
  "sc-langata": ["sch-1"],
  "sc-ruiru": ["sch-2"],
  "sc-kasarani": ["sch-3"],
  "sc-jomvu": ["sch-4"],
};

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users: User[] = [
  {
    id: "usr-1",
    name: "Grace Wafula",
    email: "superadmin@cbe.go.ke",
    role: "SUPER_ADMIN",
    schoolIds: schools.map((s) => s.id),
    countyIds: counties.map((c) => c.id),
    active: true,
  },
  {
    id: "usr-2",
    name: "Peter Otieno",
    email: "county@nairobi.cbe.go.ke",
    role: "COUNTY_ADMIN",
    schoolIds: ["sch-1", "sch-3"],
    countyIds: ["ct-nairobi"],
    active: true,
  },
  {
    id: "usr-3",
    name: "Jane Mwangi",
    email: "subcounty@kasarani.cbe.go.ke",
    role: "SUB_COUNTY_ADMIN",
    schoolIds: ["sch-3"],
    countyIds: ["ct-nairobi"],
    active: true,
  },
  {
    id: "usr-4",
    name: "Joseph Kiptoo",
    email: "admin@langataestate.ac.ke",
    role: "SCHOOL_ADMIN",
    schoolIds: ["sch-1"],
    countyIds: ["ct-nairobi"],
    active: true,
  },
  {
    id: "usr-5",
    name: "Mary Wanjiku",
    email: "teacher@langataestate.ac.ke",
    role: "TEACHER",
    schoolIds: ["sch-1"],
    countyIds: ["ct-nairobi"],
    active: true,
  },
  {
    id: "usr-6",
    name: "David Maina",
    email: "teacher2@ruirujs.ac.ke",
    role: "TEACHER",
    schoolIds: ["sch-2"],
    countyIds: ["ct-kiambu"],
    active: true,
  },
];

/* ------------------------------------------------------------------ */
/* Classes & learners                                                  */
/* ------------------------------------------------------------------ */

export const classes: SchoolClass[] = [
  { id: "cls-1", schoolId: "sch-1", grade: "G5", stream: "Brown", teacherId: "usr-5" },
  { id: "cls-2", schoolId: "sch-1", grade: "G5", stream: "Blue", teacherId: "usr-5" },
  { id: "cls-3", schoolId: "sch-1", grade: "G4", stream: "Yellow" },
  { id: "cls-4", schoolId: "sch-1", grade: "G3", stream: "Green" },
  { id: "cls-5", schoolId: "sch-1", grade: "G1", stream: "Red" },
  { id: "cls-6", schoolId: "sch-1", grade: "PP1", stream: "Sunrise" },
  { id: "cls-7", schoolId: "sch-2", grade: "G7", stream: "A", teacherId: "usr-6" },
  { id: "cls-8", schoolId: "sch-2", grade: "G8", stream: "A", teacherId: "usr-6" },
  { id: "cls-9", schoolId: "sch-3", grade: "G4", stream: "Blue" },
  { id: "cls-10", schoolId: "sch-4", grade: "G6", stream: "A" },
];

const G5_CLASS = "cls-1";

interface SeedLearner {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: "M" | "F";
  classId: string;
  guardian?: string;
  phone?: string;
}

const seedLearners: SeedLearner[] = [
  { firstName: "Brian", middleName: "Otieno", lastName: "Odhiambo", gender: "M", classId: G5_CLASS, guardian: "Mama Odhiambo", phone: "0721 100 101" },
  { firstName: "Cynthia", middleName: "Njeri", lastName: "Wairimu", gender: "F", classId: G5_CLASS, guardian: "Mr. Kamau", phone: "0722 100 102" },
  { firstName: "Daniel", middleName: "Kipchoge", lastName: "Kiplagat", gender: "M", classId: G5_CLASS, guardian: "Mrs. Chelangat", phone: "0723 100 103" },
  { firstName: "Esther", middleName: "Akinyi", lastName: "Achieng", gender: "F", classId: G5_CLASS, guardian: "Mr. Onyango", phone: "0724 100 104" },
  { firstName: "Faith", middleName: "Wangari", lastName: "Njoroge", gender: "F", classId: G5_CLASS, guardian: "Mrs. Njoroge", phone: "0725 100 105" },
  { firstName: "Geofrey", middleName: "Muriithi", lastName: "Kariuki", gender: "M", classId: G5_CLASS, guardian: "Mr. Kariuki", phone: "0726 100 106" },
  { firstName: "Hellen", middleName: "Atieno", lastName: "Okoth", gender: "F", classId: G5_CLASS, guardian: "Mrs. Okoth", phone: "0727 100 107" },
  { firstName: "Isaac", middleName: "Kiprotich", lastName: "Langat", gender: "M", classId: G5_CLASS, guardian: "Mr. Langat", phone: "0728 100 108" },
  { firstName: "Joy", middleName: "Wambui", lastName: "Muthoni", gender: "F", classId: G5_CLASS, guardian: "Mrs. Mwangi", phone: "0729 100 109" },
  { firstName: "Kevin", middleName: "Abdullahi", lastName: "Hassan", gender: "M", classId: G5_CLASS, guardian: "Mr. Hassan", phone: "0730 100 110" },
  { firstName: "Linet", middleName: "Chebet", lastName: "Kosgei", gender: "F", classId: G5_CLASS, guardian: "Mrs. Kosgei", phone: "0731 100 111" },
  { firstName: "Moses", middleName: "Kipng'etich", lastName: "Rono", gender: "M", classId: G5_CLASS, guardian: "Mr. Rono", phone: "0732 100 112" },
  { firstName: "Nancy", middleName: "Adhiambo", lastName: "Awuor", gender: "F", classId: G5_CLASS, guardian: "Mrs. Awuor", phone: "0733 100 113" },
  { firstName: "Samuel", middleName: "Kamau", lastName: "Kibet", gender: "M", classId: G5_CLASS, guardian: "Mr. Kibet", phone: "0734 100 114" },
  { firstName: "Victor", middleName: "Ochieng", lastName: "Omondi", gender: "M", classId: "cls-5", guardian: "Mrs. Omondi", phone: "0735 100 115" },
  { firstName: "Amina", middleName: "Mwende", lastName: "Kilonzo", gender: "F", classId: "cls-6", guardian: "Mr. Kilonzo", phone: "0736 100 116" },
  { firstName: "Beatrice", middleName: "Njoki", lastName: "Wanjiku", gender: "F", classId: "cls-3", guardian: "Mrs. Wanjiku", phone: "0737 100 117" },
  { firstName: "Collins", middleName: "Kipkoech", lastName: "Rotich", gender: "M", classId: "cls-3", guardian: "Mr. Rotich", phone: "0738 100 118" },
  { firstName: "Diana", middleName: "Mwikali", lastName: "Ndanu", gender: "F", classId: "cls-4", guardian: "Mrs. Ndanu", phone: "0739 100 119" },
  { firstName: "Erick", middleName: "Mwangi", lastName: "Gitau", gender: "M", classId: "cls-4", guardian: "Mr. Gitau", phone: "0740 100 120" },
  { firstName: "Fiona", middleName: "Nafula", lastName: "Wechuli", gender: "F", classId: "cls-7", guardian: "Mrs. Wechuli", phone: "0741 100 121" },
  { firstName: "George", middleName: "Waweru", lastName: "Njuguna", gender: "M", classId: "cls-7", guardian: "Mr. Njuguna", phone: "0742 100 122" },
  { firstName: "Hadija", middleName: "Zawadi", lastName: "Yusuf", gender: "F", classId: "cls-8", guardian: "Mr. Yusuf", phone: "0743 100 123" },
  { firstName: "Ian", middleName: "Mutua", lastName: "Maingi", gender: "M", classId: "cls-9", guardian: "Mrs. Maingi", phone: "0744 100 124" },
  { firstName: "Janet", middleName: "Kanini", lastName: "Mbithi", gender: "F", classId: "cls-10", guardian: "Mr. Mbithi", phone: "0745 100 125" },
];

let learnerSeq = 1;
export const learners: Learner[] = seedLearners.map((s, i) => {
  const id = `lnr-${learnerSeq++}`;
  return {
    id,
    upi: String(4000000000 + i * 137).padStart(10, "0").slice(0, 10),
    nemis: `N${80000 + i * 17}`,
    firstName: s.firstName,
    middleName: s.middleName,
    lastName: s.lastName,
    gender: s.gender,
    dob: new Date(2010 + (i % 6), i % 12, (i % 27) + 1).toISOString().slice(0, 10),
    schoolId: classes.find((c) => c.id === s.classId)!.schoolId,
    classId: s.classId,
    guardianName: s.guardian,
    guardianPhone: s.phone,
    admissionYear: 2020 + (i % 5),
  };
});

/* ------------------------------------------------------------------ */
/* Curriculum                                                          */
/* ------------------------------------------------------------------ */

/** Starter data — verify against the current KICD curriculum framework. */
const areaDefs: Array<{
  code: string;
  name: string;
  grades: GradeCode[];
  strands: string[];
}> = [
  {
    code: "MAT",
    name: "Mathematics",
    grades: ["PP1", "PP2", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Numbers and Operations", "Measurement", "Geometry", "Data Handling"],
  },
  {
    code: "ENG",
    name: "English",
    grades: ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Listening and Speaking", "Reading", "Writing", "Grammar"],
  },
  {
    code: "KIS",
    name: "Kiswahili",
    grades: ["PP1", "PP2", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Kusikiliza na Kuzungumza", "Kusoma", "Kuandika", "Matumizi ya Lugha"],
  },
  {
    code: "SCI",
    name: "Integrated Science",
    grades: ["G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Living Things", "Environment and Conservation", "Matter and Energy", "Earth and Space"],
  },
  {
    code: "SST",
    name: "Social Studies",
    grades: ["G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Our Country", "People and Population", "Economic Activities", "Governance"],
  },
  {
    code: "AGR",
    name: "Agriculture and Nutrition",
    grades: ["G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Crop Production", "Animal Production", "Nutrition and Health"],
  },
  {
    code: "CRE",
    name: "Religious Education (CRE)",
    grades: ["PP1", "PP2", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Creation", "The Family", "The Church", "Values and Morals"],
  },
  {
    code: "PE",
    name: "Sports and Physical Education",
    grades: ["PP1", "PP2", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"],
    strands: ["Athletics", "Games", "Movement and Coordination"],
  },
];

let laSeq = 1;
let stSeq = 1;
let sstSeq = 1;

const learningAreas: LearningArea[] = [];
const strands: Strand[] = [];
const subStrands: SubStrand[] = [];

for (const area of areaDefs) {
  const laId = `la-${laSeq++}`;
  learningAreas.push({ id: laId, code: area.code, name: area.name, grades: area.grades });
  for (const strandName of area.strands) {
    const stId = `st-${stSeq++}`;
    strands.push({
      id: stId,
      learningAreaId: laId,
      code: `${area.code}.${stSeq - 1}`,
      name: strandName,
      grades: area.grades,
    });
    for (const grade of area.grades) {
      const count = 2;
      for (let k = 1; k <= count; k++) {
        subStrands.push({
          id: `sst-${sstSeq++}`,
          strandId: stId,
          code: `${area.code}.${stSeq - 1}.${k}`,
          name: `${strandName} — Competency ${k}`,
          grade,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Enrollments, scores, comments                                       */
/* ------------------------------------------------------------------ */

let enrSeq = 1;
export const enrollments: Enrollment[] = learners.map((l) => ({
  id: `enr-${enrSeq++}`,
  learnerId: l.id,
  classId: l.classId!,
  year: 2026,
  term: 1,
  status: "ACTIVE",
}));

const currentTerm: Term = { year: 2026, term: 3 };

let scrSeq = 1;
const scoreByLearner: Record<string, Record<string, number>> = {};
const scores: ScoreRow[] = [];

for (const learner of learners) {
  const cls = classes.find((c) => c.id === learner.classId);
  if (!cls) continue;
  const gradeSubs = subStrands.filter((s) => s.grade === cls.grade);
  const bucket: Record<string, number> = {};
  for (const sub of gradeSubs) {
    const score = Math.round(4 + prng() * 6.5);
    bucket[sub.id] = score;
    scores.push({
      id: `scr-${scrSeq++}`,
      term: currentTerm,
      learnerId: learner.id,
      subStrandId: sub.id,
      score,
    });
  }
  scoreByLearner[learner.id] = bucket;
}

let cmtSeq = 1;
export const comments: CommentEntry[] = learners.slice(0, 6).map((l) => ({
  id: `cmt-${cmtSeq++}`,
  term: currentTerm,
  learnerId: l.id,
  teacherComment: `${l.firstName} has made steady progress this term. Keep practising at home.`,
  headComment: "Good progress. Encouraged to participate in co-curricular activities.",
  nextTermFocus: "Reading comprehension and problem solving.",
}));

/* ------------------------------------------------------------------ */
/* Root database object                                                */
/* ------------------------------------------------------------------ */

export const db = {
  nextId: {
    learner: learnerSeq,
    score: scrSeq,
    enrollment: enrSeq,
    comment: cmtSeq,
    user: users.length + 1,
  },
  currentTerm,
  counties,
  subCounties,
  schools,
  users,
  classes,
  learners,
  learningAreas,
  strands,
  subStrands,
  enrollments,
  scores,
  scoreByLearner,
  comments,
};

export type DB = typeof db;