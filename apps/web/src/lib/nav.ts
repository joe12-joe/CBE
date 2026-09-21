import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  LayoutDashboard,
  School,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: string;
  match?: string;
}

export const NAV_SECTIONS = ["Overview", "Learners", "Academics", "Oversight", "Administration"];

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
    section: "Overview",
    match: "exact",
  },
  {
    to: "/learners",
    label: "Learners",
    icon: Users,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
    section: "Learners",
  },
  {
    to: "/curriculum",
    label: "Curriculum",
    icon: BookOpen,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN"],
    section: "Academics",
  },
  {
    to: "/assessment",
    label: "Assessment",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
    section: "Academics",
  },
  {
    to: "/reports",
    label: "Report Cards",
    icon: FileText,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
    section: "Academics",
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN"],
    section: "Oversight",
  },
  {
    to: "/schools",
    label: "Schools",
    icon: School,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN"],
    section: "Oversight",
  },
  {
    to: "/users",
    label: "Users & Roles",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN"],
    section: "Administration",
  },
];

export const APP_META = {
  name: "CBE Manager",
  tagline: "Kenya Competency-Based Education",
};

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}