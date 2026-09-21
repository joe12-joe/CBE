import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useSchoolStore } from "@/stores/schoolStore";
import { getSchoolsForUser } from "@/services/schools";

/**
 * Resolves the active school for the current user. Multi-school roles
 * (county/super admins) can switch; single-school roles are pinned.
 */
export function useSchoolContext() {
  const user = useAuthStore((s) => s.user)!;
  const { schoolId, setSchoolId } = useSchoolStore();

  const { data: schools = [] } = useQuery({
    queryKey: ["schools", "for-user", user.id],
    queryFn: () => getSchoolsForUser(user),
    enabled: !!user,
  });

  const resolved = schoolId && schools.some((s) => s.id === schoolId) ? schoolId : (user.schoolIds[0] ?? schools[0]?.id ?? null);

  return {
    user,
    schools,
    schoolId: resolved,
    setSchoolId,
  };
}