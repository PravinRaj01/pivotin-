export type NavItem = { href: string; label: string; step: number };
export type NavGroup = { title: string; items: NavItem[] };

// Eight screens in three named groups (Miller's law: no group over 4).
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Build your pivot",
    items: [
      { href: "/intake", label: "Tell your story", step: 1 },
      { href: "/skills", label: "Skill bridge", step: 2 },
      { href: "/plan", label: "Weekly plan", step: 3 },
      { href: "/projects", label: "Portfolio projects", step: 4 },
    ],
  },
  {
    title: "Practise and track",
    items: [
      { href: "/interview", label: "Mock interviews", step: 5 },
      { href: "/checkin", label: "Weekly check-in", step: 6 },
      { href: "/tracker", label: "Applications", step: 7 },
    ],
  },
  {
    title: "Setup",
    items: [{ href: "/wispr", label: "Wispr Pro transform", step: 8 }],
  },
];

export const ALL_SCREENS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
