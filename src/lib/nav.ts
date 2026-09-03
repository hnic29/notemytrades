import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookOpen,
  ListOrdered,
  NotebookPen,
  BarChart3,
  ClipboardList,
  Target,
  Building2,
  History,
  PlayCircle,
  Sparkles,
  PiggyBank,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Daily Journal", href: "/journal", icon: BookOpen },
  { label: "Trade Log", href: "/trades", icon: ListOrdered },
  { label: "Trade Replay", href: "/trades/replay", icon: PlayCircle },
  { label: "Notebook", href: "/notebook", icon: NotebookPen },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Strategies", href: "/strategies", icon: ClipboardList },
  { label: "Progress Tracker", href: "/progress", icon: Target },
  { label: "Prop Accounts", href: "/prop-accounts", icon: Building2 },
  { label: "Backtesting & Replay", href: "/backtesting", icon: History },
  { label: "Take-Home", href: "/take-home", icon: PiggyBank },
  { label: "AI Insights", href: "/ai", icon: Sparkles },
];
