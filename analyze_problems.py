import json

file_path = '/home/friend/.gemini/antigravity/scratch/water-resources-exam/src/data/problems.json'

with open(file_path, 'r', encoding='utf-8') as f:
    problems = json.load(f)

total = len(problems)
implemented = 0
not_implemented = 0
categories = {}

for p in problems:
    if p.get('implemented', False):
        implemented += 1
    else:
        not_implemented += 1
        cat = p.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1

print(f"Total problems: {total}")
print(f"Implemented (has graphics): {implemented}")
print(f"Missing graphics: {not_implemented}")
print("\nMissing graphics by category:")
for cat, count in categories.items():
    print(f"  {cat}: {count}")
