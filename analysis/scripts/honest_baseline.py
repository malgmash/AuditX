import sys, collections
from generator.build import generate
from app.detect.runner import detect_all
seed=int(sys.argv[1]) if len(sys.argv)>1 else 42
ds=generate(45,6,seed,inject=False)
f=detect_all(ds.context())
print(f"seed {seed}: users {len(ds.profiles)} expenses {len(ds.expenses)} timesheets {len(ds.timesheets)} | findings on honest data: {len(f)}")
c=collections.Counter((x.rule_id,x.severity) for x in f)
for k,v in sorted(c.items()): print("  ",k,v)
