from app.categories import CATEGORIES
from generator.build import generate


def test_every_generated_category_is_in_the_fixed_list():
    ds = generate(employees=20, months=3, seed=3, inject=False, receipt_mode="synthetic")
    assert {x.rec.category for x in ds.expenses} <= set(CATEGORIES)
    assert {m.category for m in ds.merchants} <= set(CATEGORIES)
