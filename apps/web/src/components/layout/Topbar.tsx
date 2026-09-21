import { useNavigate } from "react-router-dom";
import { Building2, CalendarRange, LogOut, User as UserIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTermStore } from "@/stores/termStore";
import { useSchoolContext } from "@/lib/useSchool";
import { termLabel } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABEL } from "@/stores/authStore";
import { initials } from "@/lib/format";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { term, setTerm } = useTermStore();
  const { schools, schoolId, setSchoolId } = useSchoolContext();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur print:hidden lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {schools.length > 1 && (
          <Select value={schoolId ?? undefined} onValueChange={setSchoolId}>
            <SelectTrigger className="h-8 w-64 border-0 bg-transparent px-2 shadow-none focus:ring-0">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select school" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Select value={String(term.term)} onValueChange={(v) => setTerm({ ...term, term: Number(v) as 1 | 2 | 3 })}>
        <SelectTrigger className="h-8 w-44">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3].map((t) => (
            <SelectItem key={t} value={String(t)}>
              {termLabel({ year: term.year, term: t })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <span className="mt-1 text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/users")}>
            <UserIcon /> My account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}