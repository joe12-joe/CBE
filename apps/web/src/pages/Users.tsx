import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { listUsers, createUser, setUserActive } from "@/services/auth";
import { getSchoolsForUser, listCounties, listSubCounties } from "@/services/schools";
import { rolesUserMayCreate, ROLE_SCOPE } from "@/lib/rbac";
import { ROLE_LABEL } from "@/stores/authStore";
import { useAuthStore } from "@/stores/authStore";
import { userSchema, type UserFormValues } from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/types";

export function UsersPage() {
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const creatable = rolesUserMayCreate(me.role);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });

  const { data: mySchools = [] } = useQuery({
    queryKey: ["schools", "for-user", me.id],
    queryFn: () => getSchoolsForUser(me),
    enabled: !!me,
  });
  const { data: counties = [] } = useQuery({ queryKey: ["counties"], queryFn: listCounties });
  const { data: subCounties = [] } = useQuery({ queryKey: ["sub-counties"], queryFn: () => listSubCounties() });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setUserActive(id, active),
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const scopeLabel = (u: { role: Role; schoolIds: string[]; countyIds: string[]; subCountyIds: string[] }) => {
    if (u.role === "SUPER_ADMIN") return "National";
    const school = mySchools.find((s) => s.id === u.schoolIds[0]);
    if (school) return school.name;
    const sub = subCounties.find((s) => s.id === u.subCountyIds[0]);
    if (sub) return sub.name;
    const county = counties.find((c) => c.id === u.countyIds[0]);
    if (county) return county.name;
    return "—";
  };

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description={`You can manage: ${creatable.map((r) => ROLE_LABEL[r]).join(", ")}`}
        actions={
          creatable.length > 0 ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus /> Add user
                </Button>
              </DialogTrigger>
              <AddUserDialog
                mySchools={mySchools}
                counties={counties}
                subCounties={subCounties}
                onDone={() => setOpen(false)}
              />
            </Dialog>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState title="No users" description="Add your first user to get started." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === me.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1.5">
                      <ShieldCheck className="h-3 w-3" />
                      {ROLE_LABEL[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{scopeLabel(u)}</TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge variant="outline" className="gap-1.5 text-success">
                        <UserCheck className="h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 text-danger">
                        <UserX className="h-3 w-3" /> Deactivated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={u.id === me.id}
                      onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AddUserDialog({
  mySchools,
  counties,
  subCounties,
  onDone,
}: {
  mySchools: Awaited<ReturnType<typeof getSchoolsForUser>>;
  counties: Awaited<ReturnType<typeof listCounties>>;
  subCounties: Awaited<ReturnType<typeof listSubCounties>>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user)!;
  const creatable = rolesUserMayCreate(currentUser.role);

  // Schools the caller can actually scope a new user to (their own scope).
  const scopedSchools = mySchools.filter(
    (s) =>
      currentUser.role === "SUPER_ADMIN" ||
      currentUser.schoolIds.includes(s.id) ||
      currentUser.countyIds.includes(s.countyId) ||
      currentUser.subCountyIds.includes(s.subCountyId)
  );

  const [schoolId, setSchoolId] = useState("");
  const [subCountyId, setSubCountyId] = useState("");
  const [countyId, setCountyId] = useState("");

  const defaultRole: Role = creatable.includes("TEACHER") ? "TEACHER" : creatable[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: defaultRole },
  });

  const role = watch("role");
  const scope = ROLE_SCOPE[role];

  useEffect(() => {
    if (!schoolId && scopedSchools[0]) setSchoolId(scopedSchools[0].id);
  }, [scopedSchools, schoolId]);
  useEffect(() => {
    if (!subCountyId && subCounties[0]) setSubCountyId(subCounties[0].id);
  }, [subCounties, subCountyId]);
  useEffect(() => {
    if (!countyId && counties[0]) setCountyId(counties[0].id);
  }, [counties, countyId]);

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      createUser({
        ...values,
        schoolId: scope === "school" ? (schoolId || scopedSchools[0]?.id) : undefined,
        subCountyId: scope === "sub_county" ? (subCountyId || subCounties[0]?.id) : undefined,
        countyId: scope === "county" ? (countyId || counties[0]?.id) : undefined,
      }),
    onSuccess: () => {
      toast.success("User added — share the generated password.");
      qc.invalidateQueries({ queryKey: ["users"] });
      reset();
      setSchoolId("");
      setSubCountyId("");
      setCountyId("");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add user"),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add a user</DialogTitle>
      </DialogHeader>
      <form id="add-user" onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormGrid>
          <FormField label="Full name" error={errors.name?.message} required>
            <Input {...register("name")} />
          </FormField>
          <FormField label="Email" error={errors.email?.message} required>
            <Input type="email" {...register("email")} />
          </FormField>
        </FormGrid>
        <FormField label="Role" error={errors.role?.message} required>
          <Select value={role} onValueChange={(v) => setValue("role", v as Role, { shouldValidate: true })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {creatable.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {scope === "school" && (
          <FormField
            label="School"
            hint={scopedSchools.length === 0 ? "No schools in your scope." : "The school this account is scoped to."}
          >
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopedSchools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        {scope === "sub_county" && (
          <FormField label="Sub-county" hint="The sub-county this account is scoped to.">
            <Select value={subCountyId} onValueChange={setSubCountyId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subCounties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        {scope === "county" && (
          <FormField label="County" hint="The county this account is scoped to.">
            <Select value={countyId} onValueChange={setCountyId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {counties.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form="add-user" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          Add user
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}