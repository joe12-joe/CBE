import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { GRADE_ORDER } from "@/lib/format";
import { supabase, supabaseEnabled, supabaseError } from "@/lib/supabase";
import type {
  GradeCode,
  LearningArea,
  LearningAreaNode,
  StrandNode,
  SubStrand,
} from "@/lib/types";

// --- Live (Supabase) implementation -----------------------------------------

async function sbListLearningAreas(grade?: GradeCode): Promise<LearningArea[]> {
  const { data, error } = grade
    ? await supabase!
        .from("learning_areas")
        .select("id, code, name, learning_area_grades!inner(grade)")
        .eq("learning_area_grades.grade", grade)
        .order("name")
    : await supabase!.from("learning_areas").select("id, code, name, learning_area_grades(grade)").order("name");
  if (error) throw supabaseError(error, "Could not list learning areas.");
  return (data ?? []).map((r) => ({
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    grades: (r.learning_area_grades as Array<{ grade: string }>).map((g) => g.grade as GradeCode),
  }));
}

async function sbListCurriculumTree(grade: GradeCode): Promise<LearningAreaNode[]> {
  const { data, error } = await supabase!
    .from("learning_areas")
    .select(
      "id, code, name, strands!inner(id, code, name, sub_strands!inner(id, code, name, grade, strand_id))"
    )
    .eq("strands.sub_strands.grade", grade)
    .order("name");
  if (error) throw supabaseError(error, "Could not load the curriculum.");
  const nodes: LearningAreaNode[] = [];
  for (const area of data ?? []) {
    const strandNodes: StrandNode[] = [];
    for (const st of (area.strands as Array<Record<string, unknown>>) ?? []) {
      const subStrands = ((st.sub_strands as Array<Record<string, unknown>>) ?? []).map((s) => ({
        id: String(s.id),
        strandId: String(s.strand_id),
        code: String(s.code),
        name: String(s.name),
        grade: String(s.grade) as GradeCode,
      }));
      if (subStrands.length === 0) continue;
      strandNodes.push({
        id: String(st.id),
        learningAreaId: String(area.id),
        code: String(st.code),
        name: String(st.name),
        grades: [grade],
        subStrands,
      });
    }
    if (strandNodes.length === 0) continue;
    nodes.push({
      id: String(area.id),
      code: String(area.code),
      name: String(area.name),
      grades: strandNodes.flatMap((s) => s.grades),
      strands: strandNodes,
    });
  }
  return nodes;
}

async function sbGetLearningArea(id: string): Promise<LearningArea> {
  const { data, error } = await supabase!
    .from("learning_areas")
    .select("id, code, name, learning_area_grades(grade)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw supabaseError(error, "Could not load the learning area.");
  if (!data) throw new ApiError(404, "Learning area not found.");
  return {
    id: String(data.id),
    code: String(data.code),
    name: String(data.name),
    grades: (data.learning_area_grades as Array<{ grade: string }>).map((g) => g.grade as GradeCode),
  };
}

async function sbAddSubStrand(input: {
  learningAreaId: string;
  strandId?: string;
  strandName: string;
  name: string;
  grade: GradeCode;
}): Promise<SubStrand> {
  const { data: area, error: areaErr } = await supabase!
    .from("learning_areas")
    .select("id, code")
    .eq("id", input.learningAreaId)
    .maybeSingle();
  if (areaErr) throw supabaseError(areaErr, "Could not load the learning area.");
  if (!area) throw new ApiError(404, "Learning area not found.");

  let strandId = input.strandId;
  if (!strandId) {
    const { count } = await supabase!
      .from("strands")
      .select("id", { count: "exact", head: true })
      .eq("learning_area_id", input.learningAreaId);
    const { data: strand, error: strandErr } = await supabase!
      .from("strands")
      .insert({
        code: `${area.code}.${(count ?? 0) + 1}`,
        name: input.strandName,
        learning_area_id: input.learningAreaId,
      })
      .select("id")
      .single();
    if (strandErr) throw supabaseError(strandErr, "Could not create the strand.");
    strandId = String(strand.id);
    await supabase!.from("strand_grades").insert(
      GRADE_ORDER.map((g) => ({ strand_id: strandId, grade: g }))
    );
  }

  const { count: subCount } = await supabase!
    .from("sub_strands")
    .select("id", { count: "exact", head: true })
    .eq("strand_id", strandId);
  const { data: sub, error: subErr } = await supabase!
    .from("sub_strands")
    .insert({
      code: `${area.code}.${(subCount ?? 0) + 2}`,
      name: input.name,
      grade: input.grade,
      strand_id: strandId,
    })
    .select("id, strand_id, code, name, grade")
    .single();
  if (subErr) throw supabaseError(subErr, "Could not add the sub-strand.");
  return {
    id: String(sub.id),
    strandId: String(sub.strand_id),
    code: String(sub.code),
    name: String(sub.name),
    grade: String(sub.grade) as GradeCode,
  };
}

// --- Mock fallback -----------------------------------------------------------

export async function listGrades(): Promise<GradeCode[]> {
  if (supabaseEnabled()) await delay(60);
  return [...GRADE_ORDER];
}

export async function listLearningAreas(grade?: GradeCode): Promise<LearningArea[]> {
  if (supabaseEnabled()) return sbListLearningAreas(grade);
  await delay();
  return db.learningAreas
    .filter((la) => !grade || la.grades.includes(grade))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Learning areas for a grade, with their strands and (grade-specific) sub-strands expanded. */
export async function listCurriculumTree(grade: GradeCode): Promise<LearningAreaNode[]> {
  if (supabaseEnabled()) return sbListCurriculumTree(grade);
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
  if (supabaseEnabled()) return sbGetLearningArea(id);
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
  if (supabaseEnabled()) return sbAddSubStrand(input);
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