"""Employee spending personalities.

Each employee draws a persistent profile at creation: a category mix, an amount scale, how quickly
they submit, whether they claim on weekends, how often they work remotely. Without these,
EXP_AMOUNT_OUTLIER_SELF has nothing to work against and every detector looks better than it is.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import date

from faker import Faker

DEPARTMENTS: dict[str, dict] = {
    "Sales": {
        "size": 12,
        "titles": ["Account executive", "Senior account executive", "Sales manager", "Regional sales lead"],
        "mix": {"Meals": .32, "Client Entertainment": .20, "Transport": .18, "Software": .04, "Supplies": .05, "Training": .03, "Other": .06, "Equipment": .02},
        "trips": (4, 8),
    },
    "Engineering": {
        "size": 12,
        "titles": ["Software engineer", "Senior software engineer", "Staff engineer", "Engineering manager"],
        "mix": {"Meals": .30, "Equipment": .12, "Software": .20, "Supplies": .08, "Transport": .10, "Training": .08, "Other": .10, "Client Entertainment": .02},
        "trips": (0, 2),
    },
    "Operations": {
        "size": 8,
        "titles": ["Operations associate", "Operations analyst", "Office manager", "Operations lead"],
        "mix": {"Meals": .26, "Supplies": .26, "Transport": .15, "Equipment": .10, "Other": .11, "Software": .08, "Training": .03, "Client Entertainment": .01},
        "trips": (0, 2),
    },
    "Marketing": {
        "size": 7,
        "titles": ["Marketing coordinator", "Content strategist", "Brand manager", "Marketing director"],
        "mix": {"Meals": .26, "Client Entertainment": .12, "Software": .18, "Supplies": .10, "Transport": .10, "Training": .08, "Other": .09, "Equipment": .07},
        "trips": (2, 4),
    },
    "Finance": {
        "size": 6,
        "titles": ["Bookkeeper", "Financial analyst", "Accounting manager", "Finance lead"],
        "mix": {"Meals": .30, "Software": .20, "Supplies": .20, "Training": .10, "Transport": .10, "Other": .10},
        "trips": (0, 1),
    },
}

# Median claim in cents per category, and the spread of an individual's amounts (log scale).
CATEGORY_MEDIAN = {
    "Meals": 2400, "Client Entertainment": 9500, "Travel": 42000, "Lodging": 17500, "Transport": 2600,
    "Equipment": 7500, "Software": 1800, "Supplies": 3800, "Training": 16000, "Other": 2800,
}
CATEGORY_SIGMA = {
    "Meals": 0.22, "Client Entertainment": 0.25, "Travel": 0.25, "Lodging": 0.22, "Transport": 0.25,
    "Equipment": 0.30, "Software": 0.20, "Supplies": 0.28, "Training": 0.28, "Other": 0.28,
}


@dataclass
class Profile:
    user_id: str
    name: str
    email: str
    department: str
    job_title: str
    start_date: date
    role: str
    category_weights: dict[str, float]
    amount_scale: float
    monthly_rate: float
    submit_delay_days: float
    weekend_share: float
    remote_share: float
    trips: int
    project_names: list[str] = field(default_factory=list)
    start_minute: int = 540  # minutes after midnight the person usually starts


def poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def choose(rng: random.Random, weights: dict[str, float]) -> str:
    total = sum(weights.values())
    x = rng.random() * total
    for key, w in weights.items():
        x -= w
        if x <= 0:
            return key
    return next(iter(weights))


def build_profiles(rng: random.Random, employees: int, start: date) -> list[Profile]:
    fake = Faker("en_US")
    fake.seed_instance(rng.randrange(1 << 30))

    # Scale the department sizes to the requested headcount, keeping the mix.
    base = sum(d["size"] for d in DEPARTMENTS.values())
    sizes = {k: max(5, round(d["size"] * employees / base)) for k, d in DEPARTMENTS.items()}
    while sum(sizes.values()) > employees:
        sizes[max(sizes, key=sizes.get)] -= 1
    while sum(sizes.values()) < employees:
        sizes[min(sizes, key=sizes.get)] += 1

    profiles: list[Profile] = []
    n = 0
    for dept, size in sizes.items():
        spec = DEPARTMENTS[dept]
        for i in range(size):
            n += 1
            uid = f"emp_{n:03d}"
            name = fake.name()
            weights = {k: v * math.exp(rng.gauss(0, 0.3)) for k, v in spec["mix"].items()}
            total = sum(weights.values())
            weights = {k: v / total for k, v in weights.items()}
            lo, hi = spec["trips"]
            profiles.append(
                Profile(
                    user_id=uid,
                    name=name,
                    email=f"{name.lower().replace(' ', '.').replace(chr(39), '')}.{n}@auditx.demo",
                    department=dept,
                    job_title=spec["titles"][min(len(spec["titles"]) - 1, i * len(spec["titles"]) // size)],
                    start_date=date(start.year - rng.randint(1, 4), rng.randint(1, 12), rng.randint(1, 28)),
                    role="EMPLOYEE",
                    category_weights=weights,
                    amount_scale=math.exp(rng.gauss(0, 0.2)),
                    monthly_rate=max(4.0, rng.gauss(9.0, 2.5)),
                    submit_delay_days=rng.choice([1.0, 2.0, 3.0, 5.0, 8.0]),
                    weekend_share=0.0 if rng.random() < 0.65 else rng.uniform(0.03, 0.10),
                    remote_share=0.0 if rng.random() < 0.5 else rng.uniform(0.1, 0.4),
                    trips=rng.randint(lo, hi),
                    project_names=[f"{dept[:3].upper()}-{rng.randint(100, 999)}" for _ in range(3)],
                    start_minute=rng.choice([525, 540, 540, 555, 570]),
                )
            )
    # The first Operations person is the administrator and the first Sales person the demo
    # employee, matching web/prisma/seed.ts so the seeded logins own real data.
    admin = next(p for p in profiles if p.department == "Operations")
    admin.name, admin.email, admin.role, admin.job_title = "Morgan Reyes", "admin@auditx.local", "ADMIN", "Operations lead"
    demo = next(p for p in profiles if p.department == "Sales")
    demo.name, demo.email, demo.job_title = "Jamie Okafor", "employee@auditx.local", "Account executive"
    return profiles
