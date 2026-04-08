export const moduleNavigationItems = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Your week at a glance.",
  },
  {
    href: "/cardio",
    title: "Cardio",
    description: "Rides, runs, and Zone 2 sessions.",
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
    href: "/nutrition",
    title: "Nutrition",
    description: "Daily nutrition habits.",
  },
  {
    href: "/weekly-review",
    title: "Weekly Review",
    description: "Reflect, score, and set next week's focus.",
  },
  {
    href: "/journal",
    title: "Journal",
    description: "Notes tied to your training.",
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
    description: "Connect Strava, Withings, and Apple Health.",
  },
] as const;

export type ModuleRoute = (typeof moduleNavigationItems)[number]["href"];
