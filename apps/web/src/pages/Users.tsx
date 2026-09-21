import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { listUsers, createUser, setUserActive } from "@/services/auth";
import { listSchools } from "@/services/schools";
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

const ROLES: Role[] = ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"];

export function UsersPage() {
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ["schools", "all"],
    queryFn: () => listSchools(),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setUserActive(id, active),
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage system accounts and their access levels."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> Add user
              </Button>
            </DialogTrigger>
            <AddUserDialog schools={schools} onDone={() => setOpen(false)} />
          </Dialog>
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
  schools,
  onDone,
}: {
  schools: Awaited<ReturnType<typeof listSchools>>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user)!;
  const [schoolId, setSchoolId] = useState<string>(currentUser.schoolIds[0] ?? schools[0]?.id ?? "");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "TEACHER" },
  });

  const role = watch("role");

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      createUser({ ...values, schoolId, countyId: currentUser.countyIds[0] ?? "" }),
    onSuccess: () => {
      toast.success("User added");
      qc.invalidateQueries({ queryKey: ["users"] });
      reset();
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
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="School" hint="Used as the default school scope for this account.">
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
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