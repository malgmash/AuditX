/**
 * Every string on the landing page lives here, so the copy can be reviewed in one place and the
 * components stay structural. Figures inside `mockup` and `matchedPair` are illustrative and the
 * page says so on screen; nothing here is fetched or implies a real customer.
 */

export const nav = {
  links: [
    { href: "#why-auditx", label: "Product" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#who", label: "Who it is for" },
  ],
  logIn: { href: "/login", label: "Log in" },
  getStarted: { href: "/register", label: "Get started" },
};

export const hero = {
  headline: "Find what doesn’t add up.",
  sub: "AuditX compares expenses, receipts and timesheets with your organisation’s own history, then shows reviewers exactly what deserves a closer look.",
  primary: "Get started",
  secondary: "See how it works",
  imageSrc: "/landing/hero-reviewer.jpg",
  imageAlt: "A finance reviewer sitting by an office window with a laptop",
  watchesLabel: "What the queue watches",
  watches: [
    "Duplicate receipts",
    "Near-duplicate invoices",
    "Out-of-pattern amounts",
    "Timesheet conflicts",
  ],
  matchCard: {
    label: "Receipt match",
    value: "98%",
    detail: "Same merchant and amount, 63 days apart",
  },
  holdCard: {
    label: "Held this month",
    value: "$4,180",
    detail: "Illustrative figure",
  },
};

type MockupRow = {
  title: string;
  meta: string;
  score: string;
  status: string;
  variant: "case" | "held" | "note";
  pair?: "top" | "bottom";
};

export const mockup: {
  title: string;
  subtitle: string;
  note: string;
  stats: { value: string; label: string }[];
  rows: MockupRow[];
} = {
  title: "Flagged records",
  subtitle: "Ranked by score, highest first",
  note: "Illustrative view. Not live data.",
  stats: [
    { value: "14", label: "Open cases" },
    { value: "$4,180", label: "Held this month" },
  ],
  rows: [
    {
      title: "Rosewood Supply Co, office chairs",
      meta: "Elena Vasquez · $742.00 · 14 May",
      score: "91",
      status: "Held",
      variant: "case",
      pair: "top",
    },
    {
      title: "Rosewood Supply Co, office chairs",
      meta: "Elena Vasquez · $742.00 · 16 July",
      score: "88",
      status: "Held",
      variant: "case",
      pair: "bottom",
    },
    {
      title: "Cavallini Ristorante, client dinner",
      meta: "Dmitri Okonkwo · $318.40 · 2 July",
      score: "64",
      status: "Pending review",
      variant: "held",
    },
    {
      title: "Timesheet, two sites in one shift",
      meta: "Priya Raghunathan · 8.5 hours · 9 July",
      score: "57",
      status: "Pending review",
      variant: "held",
    },
    {
      title: "Northgate Fuel, weekly mileage",
      meta: "Marcus Lindqvist · $96.20 · 11 July",
      score: "12",
      status: "Reviewed, no action",
      variant: "note",
    },
  ],
};

export const problem = {
  id: "why-auditx",
  eyebrow: "The product",
  headline: "One claim looks ordinary. The history tells the real story.",
  body: "Duplicate receipts, unusual invoices and conflicting timesheets disappear inside thousands of records. Small teams do not have a spare audit desk, so the same purchase can be claimed twice before anyone notices.",
  points: [
    { title: "Connect the records", body: "Match the same merchant, amount or receipt even when the claims are weeks apart." },
    { title: "Keep the person in charge", body: "A score changes the order of the queue. A reviewer still decides what happens next." },
    { title: "Explain it in plain language", body: "Every flag says what looks unusual and which records were compared." },
  ],
  imageSrc: "/landing/meeting.jpg",
  imageAlt: "Two colleagues reviewing records together at a meeting table",
};

export const howItWorks = {
  id: "how-it-works",
  eyebrow: "How it works",
  headline: "From a new record to a decision.",
  sub: "The system does the comparison. Your team keeps control of the outcome.",
  imageSrc: "/landing/office-desk.jpg",
  imageAlt: "Two people reviewing notes and laptops at a shared desk",
  steps: [
    {
      number: "01",
      title: "Upload",
      body: "Employees submit receipts, invoices, expenses or timesheets.",
    },
    {
      number: "02",
      title: "Compare",
      body: "AuditX retrieves similar records from the organisation’s own history.",
    },
    {
      number: "03",
      title: "Flag",
      body: "The engine marks duplicates, conflicts and amounts that break a person’s pattern.",
    },
    {
      number: "04",
      title: "Review",
      body: "A person sees the evidence, then dismisses, holds or investigates further.",
    },
  ],
};

export const features = {
  id: "features",
  eyebrow: "Inside the workspace",
  headline: "A queue for the records that need a person.",
  sub: "Scores organise the work. Status labels show what someone already decided.",
  items: [
    {
      title: "Duplicate detection",
      body: "Find repeated and near-duplicate receipts or invoices, even when they appear weeks or months apart.",
    },
    {
      title: "Behavioural anomalies",
      body: "Identify expenses or activity that significantly deviate from normal historical patterns.",
    },
    {
      title: "Investigation briefs",
      body: "Turn signals into a short explanation, the matched records, and a recommended next step.",
    },
  ],
  briefParts: [
    "What looks unusual in the record",
    "Why the records were matched to each other",
    "The recommended next step for a reviewer",
  ],
};

export const who = {
  id: "who",
  eyebrow: "Who it is for",
  headline: "Built for the people who file claims, and the people who review them.",
  roles: [
    {
      title: "Employees",
      body: "Submit an expense with a receipt, then see the status in plain language. A hold pauses reimbursement. It is not a verdict.",
      imageSrc: "/landing/phone-check.jpg",
      imageAlt: "An employee in an office, the person who would submit an expense",
    },
    {
      title: "Reviewers",
      body: "Open a ranked queue, read the evidence behind each flag, and decide: dismiss, hold, or look further.",
      imageSrc: "/landing/hero-portrait.jpg",
      imageAlt: "A reviewer in an office setting",
    },
  ],
  mosaic: {
    imageSrc: "/landing/employee-phone.jpg",
    imageAlt: "A small team discussing records around a laptop",
    stats: [
      { value: "14", label: "Open cases in the sample queue" },
      { value: "$742.00", label: "Repeated claim, 63 days apart" },
    ],
    note: "Illustrative figures. Not live data.",
  },
};

export const deviation = {
  rangeLabel: "Usual range for this person",
  rangeValue: "$40.00 to $190.00",
  claimLabel: "This claim",
  claimValue: "$742.00",
  note: "Illustrative range. Not live data.",
};

export const matchedPair = {
  heading: "Possible duplicate expense",
  note: "Illustrative pair. Not live data.",
  records: [
    { label: "Claim from 14 May", merchant: "Rosewood Supply Co", amount: "$742.00" },
    { label: "Claim from 16 July", merchant: "Rosewood Supply Co", amount: "$742.00" },
  ],
  matches: [
    { field: "Receipt similarity", value: "98%" },
    { field: "Merchant", value: "Identical" },
    { field: "Amount", value: "Identical" },
    { field: "Submitted", value: "63 days apart" },
  ],
};

export const finalCta = {
  eyebrow: "Start a review queue",
  headline: "Give your team the records that actually need a person.",
  body: "Create an organisation, invite employees, and open the same queue the demo uses: ranked, explained, decided by you.",
  haveAccount: "Already have an account?",
  imageSrc: "/landing/desk-work.jpg",
  imageAlt: "A reviewer standing in an office",
};

export const footer = {
  tagline: "Expense review with evidence, for small teams.",
  photos:
    "Photographs from Unsplash. Used to show the people who file and review claims, not as customer proof.",
  columns: [
    {
      title: "Product",
      links: [
        { href: "#why-auditx", label: "Why AuditX" },
        { href: "#how-it-works", label: "How it works" },
        { href: "#features", label: "Features" },
      ],
    },
    {
      title: "Account",
      links: [
        { href: "/login", label: "Log in" },
        { href: "/register", label: "Get started" },
        { href: "/register/employee", label: "Join an organisation" },
      ],
    },
  ],
};
