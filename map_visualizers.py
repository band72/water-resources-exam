import json

file_path = '/home/friend/.gemini/antigravity/scratch/water-resources-exam/src/data/problems.json'

with open(file_path, 'r', encoding='utf-8') as f:
    problems = json.load(f)

for p in problems:
    if not p.get('implemented', False):
        cat = p.get('category', '').lower()
        title = p.get('title', '').lower()
        desc = p.get('description', '').lower()
        
        if any(kw in cat for kw in ['structural', 'steel', 'timber', 'mechanics']):
            p['component'] = 'StructuralVisualizer'
        elif any(kw in cat for kw in ['soil', 'foundation', 'geotechnical']):
            p['component'] = 'SoilVisualizer'
        elif any(kw in cat for kw in ['means', 'planning', 'construction']):
            p['component'] = 'ConstructionVisualizer'
        elif any(kw in cat for kw in ['hydraulics', 'hydrology']) or any(kw in desc for kw in ['water', 'pipe', 'flow', 'discharge', 'basin']):
            p['component'] = 'WaterVisualizer'
        else:
            p['component'] = 'DocumentVisualizer'
            
        p['implemented'] = True

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(problems, f, indent=2)

print("Successfully mapped remaining problems to generic visualizers")
