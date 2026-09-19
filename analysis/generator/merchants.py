"""Merchant catalogue: about 120 merchants, weighted so the top 20 carry most of the volume.

All names are fictional. Each merchant has a home city and a usual category, which feeds
EXP_CATEGORY_MISMATCH and the city-level location rule.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from app.categories import CATEGORIES  # noqa: F401  re-exported for the generator

HQ_CITY = "Pittsburgh"
TRAVEL_CITIES = ["Chicago", "New York", "Boston", "Atlanta", "Austin", "Seattle", "San Francisco", "Denver"]



@dataclass(frozen=True)
class Merchant:
    id: str
    name: str
    category: str
    city: str | None  # None for online and airline merchants that have no city
    weight: float
    chain: bool  # chains print store numbers


_PGH_MEALS = [
    "Blue Door Cafe", "Steel City Diner", "Three Rivers Grill", "Mercer Street Cafe",
    "Allegheny Noodle House", "Point Bakery", "Smallman Tacos", "Lawrence Pizzeria",
    "Union Station Coffee", "Carson Street Sushi", "Strip District Deli", "Ohio Valley Kitchen",
    "Bridge Street Bagels", "Hilltop Burger Co", "Riverside Ramen", "Forbes Avenue Salads",
    "Copper Kettle Cafe", "Northside Barbecue", "Market Square Soup", "Cathedral Sandwich Shop",
    "Fern Hollow Coffee", "Iron Bridge Pizza", "Duquesne Deli", "Penn Avenue Thai",
    "Station Square Grill", "Oakland Falafel", "Bloomfield Bakery", "Shadyside Juice Bar",
]
_PGH_ENT = [
    "Fifth Avenue Steakhouse", "Grant Street Chophouse", "Overlook Terrace", "Golden Triangle Bistro",
    "Heinz Hall Lounge", "Monongahela Wine Room", "Duquesne Club Dining", "Skyline Supper Club",
]
_PGH_TRANSPORT = ["Metro Ride", "CityCab", "Yellow Line Taxi", "Keystone Rideshare", "Airport Shuttle PGH", "Steel City Parking"]
_ELECTRONICS = ["Circuit Depot", "Monitor Warehouse", "Keyboard Corner", "Gadget Junction", "Wired Outlet"]
_SOFTWARE = ["CloudDesk", "PipelineHQ", "DocuSuite", "DesignBench", "MetricsLab", "SprintBoard", "ChatLoop", "VaultKey"]
_SUPPLIES = ["Officeland", "Paper & Pen", "Corner Hardware", "Bulk Stationers", "Print Express", "Packaging Plus"]
_TRAINING = ["Regional Dev Conference", "Sales Summit", "LearnPath Courses", "Industry Expo Pass", "Finance Forum"]
_OTHER = ["City Parking Authority", "Shipping Hub", "Notary Services", "Courier Direct", "Document Archive"]
_AIRLINES = ["Keystone Air", "Great Lakes Airways", "Skyline Airlines", "Northeast Rail", "Summit Air"]

# City specific merchants for trips: 3 meals, 1 entertainment, 1 hotel, 1 transport each.
_CITY_SUFFIX = {
    "Meals": ["Lakeshore Deep Dish", "Loop Sandwich Co", "River North Cafe"],
}


def build_catalogue(rng: random.Random) -> list[Merchant]:
    out: list[Merchant] = []
    n = 0

    def add(name: str, category: str, city: str | None, weight: float, chain: bool = False) -> None:
        nonlocal n
        n += 1
        out.append(Merchant(f"mer_{n:03d}", name, category, city, weight, chain))

    def zipf(names: list[str], scale: float = 1.0) -> list[float]:
        return [scale / ((i + 1) ** 0.8) for i in range(len(names))]

    for names, cat, w in [(_PGH_MEALS, "Meals", 6.0), (_PGH_ENT, "Client Entertainment", 2.0),
                          (_PGH_TRANSPORT, "Transport", 3.0)]:
        for name, wt in zip(names, zipf(names, w)):
            add(name, cat, HQ_CITY, wt, chain=cat == "Meals" and rng.random() < 0.35)
    for names, cat, w in [(_ELECTRONICS, "Equipment", 2.0), (_SOFTWARE, "Software", 3.0),
                          (_SUPPLIES, "Supplies", 2.5), (_TRAINING, "Training", 1.0), (_OTHER, "Other", 1.2)]:
        for name, wt in zip(names, zipf(names, w)):
            add(name, cat, HQ_CITY if cat in ("Equipment", "Supplies", "Other") else None, wt,
                chain=cat in ("Equipment", "Supplies"))
    for name, wt in zip(_AIRLINES, zipf(_AIRLINES, 2.0)):
        add(name, "Travel", None, wt)

    meal_names = ["Lakeshore Deep Dish", "Loop Sandwich Co", "River North Cafe"]
    for i, city in enumerate(TRAVEL_CITIES):
        for j in range(3):
            add(f"{city} {['Kitchen', 'Deli', 'Cafe'][j]}" if i else meal_names[j], "Meals", city, 1.0)
        add(f"{city} Steakhouse", "Client Entertainment", city, 0.6)
        add(f"{city} Grand Hotel", "Lodging", city, 1.0)
        add(f"{city} Cab Co", "Transport", city, 0.8)
    return out
