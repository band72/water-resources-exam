import json

file_path = '/home/friend/.gemini/antigravity/scratch/water-resources-exam/src/data/problems.json'

with open(file_path, 'r', encoding='utf-8') as f:
    problems = json.load(f)

for p in problems:
    if p.get('id') == 1001:
        p['implemented'] = True
        p['component'] = "CpmArrowVisualizer"
        p['steps'] = [
            {"val": 245},
            {"op": "+100", "val": 345},
            {"op": "+30", "val": 375},
            {"op": "+2", "val": 377}
        ]
    elif p.get('id') == 1002:
        p['implemented'] = True
        p['component'] = "CpmArrowVisualizer"
        p['steps'] = [
            {"val": 560},
            {"op": "-200", "val": 360},
            {"op": "-40", "val": 320},
            {"op": "-5", "val": 315}
        ]
    elif p.get('id') == 1003:
        p['implemented'] = True
        p['component'] = "CpmArrowVisualizer"
        p['steps'] = [
            {"val": 398},
            {"op": "+2", "val": 400},
            {"op": "+43", "val": 443}
        ]

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(problems, f, indent=2)

print("Updated problems.json")
