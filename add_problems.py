import json
import os

file_path = '/home/friend/.gemini/antigravity/scratch/water-resources-exam/src/data/problems.json'

with open(file_path, 'r', encoding='utf-8') as f:
    problems = json.load(f)

new_problems = [
    {
        "id": 1001,
        "category": "CPM Arrow Math",
        "title": "CPM Arrow Way: Addition",
        "description": "Using the Arrow Way, what is 245 + 132?\n\nStart at 245 -> +100 -> 345 -> +30 -> 375 -> +2 -> 377",
        "implemented": False,
        "hint": "Break 132 into its place values: 100, 30, and 2.",
        "shortcut": "Add the hundreds first, then tens, then ones.",
        "fifthGrader": "Start at 245. Make a big jump of 100 to 345. Make a medium jump of 30 to 375. Make a tiny hop of 2 to get 377!"
    },
    {
        "id": 1002,
        "category": "CPM Arrow Math",
        "title": "CPM Arrow Way: Subtraction",
        "description": "Using the Arrow Way, what is 560 - 245?\n\nStart at 560 -> -200 -> 360 -> -40 -> 320 -> -5 -> 315",
        "implemented": False,
        "hint": "Break the number you are subtracting (245) into easy backward jumps.",
        "shortcut": "Subtract hundreds, then tens, then ones.",
        "fifthGrader": "Start at 560. Jump backward 200 to 360. Jump backward 40 to 320. Hop backward 5 to get 315!"
    },
    {
        "id": 1003,
        "category": "CPM Arrow Math",
        "title": "CPM Arrow Way: Make a 10",
        "description": "Using the Arrow Way, what is 398 + 45?\n\nStart at 398 -> +2 -> 400 -> +43 -> 443",
        "implemented": False,
        "hint": "Use 'friendly numbers'. Add 2 to 398 to get 400, then add the rest.",
        "shortcut": "Round 398 to 400, add 45 (445), and then subtract the 2 you added (443).",
        "fifthGrader": "398 is so close to 400! Add just 2 to reach 400. Since we took 2 out of the 45, we only have 43 left to add. 400 + 43 = 443!"
    }
]

problems.extend(new_problems)

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(problems, f, indent=2)

print("Successfully added 3 new problems to problems.json")
