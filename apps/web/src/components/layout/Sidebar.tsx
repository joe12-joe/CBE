import { NavLink } from "react-router-dom";
import { APP_META, NAV_SECTIONS, navForRole } from "@/lib/nav";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const items = navForRole(user.role);

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex print:hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
            <path d="M6 10.5 16 5.5l10 5-10 5-10-5Z" fill="currentColor" opacity="0.9" />
            <path d="M9 13.6v5.1c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5.1L16 16.5l-7-2.9Z" fill="currentColor" opacity="0.65" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">{APP_META.name}</p>
          <p className="text-[11px] text-muted-foreground">{APP_META.tagline}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
        {NAV_SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section} className="mt-4 first:mt-2">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </p>
              <ul className="space-y-0.5">
                {sectionItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.match === "exact"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t px-5 py-3">
        <p className="text-[11px] text-muted-foreground">Ministry of Education</p>
        <p className="text-[11px] text-muted-foreground">Competency-Based Curriculum</p>
      </div>
    </aside>
  );
}