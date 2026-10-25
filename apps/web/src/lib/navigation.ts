export const moduleNavigationItems = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Your week at a glance.",
  },
  {
    href: "/program",
    title: "Program",
    description: "Post-op week, today's session and progress.",
  },
  {
    href: "/cardio",
    title: "Cardio",
    description: "Rides and Zone 2 sessions.",
  },
  {
    href: "/strength",
    title: "Strength",
    description: "Lifting sessions and progress.",
  },
  {
    href: "/recovery",
    title: "Recovery",
    description: "Sleep, readiness, and daily check-ins.",
  },
  {
    href: "/body",
    title: "Body",
    description: "Weight and measurements over time.",
  },
  {
    href: "/body/dexa",
    title: "DEXA",
    description: "Scans, targets and the Withings offset.",
  },
  {
    href: "/nutrition",
    title: "Nutrition",
    description: "Daily nutrition habits.",
  },
  {
    href: "/weekly-review",
    title: "Weekly review",
    description: "Score last week and set next week.",
  },
  {
    href: "/insights",
    title: "Insights",
    description: "Trends and coaching tips.",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Profile and preferences.",
  },
  {
    href: "/integrations",
    title: "Integrations",
    description: "Withings and Apple Health sync.",
  },
] as const;

export type ModuleRoute = (typeof moduleNavigationItems)[number]["href"];
