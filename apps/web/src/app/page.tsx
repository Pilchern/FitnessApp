import { AppShell } from "@/components/shared/app-shell";

const sections = [
  {
    title: "Training",
    description:
      "Log every ride, lift, and run. Build a history you can actually learn from.",
  },
  {
    title: "Recovery",
    description:
      "Quick daily check-ins track sleep, readiness, and energy so you know when to push and when to rest.",
  },
  {
    title: "Weekly Review",
    description:
      "Reflect on the week, get a score, and set one clear priority for the week ahead.",
  },
];

export default function HomePage() {
  return <AppShell sections={sections} />;
}
