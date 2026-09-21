import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { GRADE_ORDER } from "@/lib/format";
import type {
  GradeCode,
  LearningArea,
  LearningAreaNode,
  StrandNode,
  SubStrand,
} from "@/lib/types";

export async function listGrades(): Promise<GradeCode[]> {
  await delay(80);
  return [...GRADE_ORDER];
}

export async function listLearningAreas(grade?: GradeCode): Promise<LearningArea[]> {
  await delay();
  return db.learningAreas
    .filter((la) => !grade || la.grades.includes(grade))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Learning areas for a grade, with their strands and (grade-specific) sub-strands expanded. */
export async function listCurriculumTree(grade: GradeCode): Promise<LearningAreaNode[]> {
  await delay();
  const nodes: LearningAreaNode[] = [];
  for (const la of db.learningAreas.filter((a) => a.grades.includes(grade))) {
    const strandNodes: StrandNode[] = [];
    for (const st of db.strands.filter((s) => s.learningAreaId === la.id)) {
      const subStrands = db.subStrands.filter((s) => s.strandId === st.id && s.grade === grade);
      if (subStrands.length === 0) continue;
      strandNodes.push({ ...st, subStrands });
    }
    if (strandNodes.length === 0) continue;
    nodes.push({ ...la, strands: strandNodes });
  }
  return nodes;
}

export async function getLearningArea(id: string): Promise<LearningArea> {
  await delay(120);
  const la = db.learningAreas.find((a) => a.id === id);
  if (!la) throw new ApiError(404, "Learning area not found.");
  return { ...la };
}

export async function addSubStrand(input: {
  learningAreaId: string;
  strandId?: string;
  strandName: string;
  name: string;
  grade: GradeCode;
}): Promise<SubStrand> {
  await delay(300);
  const la = db.learningAreas.find((a) => a.id === input.learningAreaId);
  if (!la) throw new ApiError(404, "Learning area not found.");

  let strand = db.strands.find((s) => s.id === input.strandId);
  if (!strand) {
    const stId = `st-${db.strands.length + db.subStrands.length + 1}`;
    strand = {
      id: stId,
      learningAreaId: la.id,
      code: `${la.code}.${db.strands.length + 1}`,
      name: input.strandName,
      grades: [...la.grades],
    };
    db.strands.push(strand);
  }

  const sub: SubStrand = {
    id: `sst-${db.subStrands.length + db.strands.length + 1}`,
    strandId: strand.id,
    code: `${strand.code}.${db.subStrands.filter((s) => s.strandId === strand.id).length + 1}`,
    name: input.name,
    grade: input.grade,
  };
  db.subStrands.push(sub);
  return sub;
}