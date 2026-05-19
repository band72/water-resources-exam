import json
import os

file_path = '/home/friend/.gemini/antigravity/scratch/water-resources-exam/src/data/problems.json'

with open(file_path, 'r', encoding='utf-8') as f:
    problems = json.load(f)

new_problems = [
    {
        "id": 2001,
        "category": "Water & Wastewater Systems",
        "title": "Total Hardness Calculation",
        "description": "A water sample contains 60 mg/L of Ca2+ and 24 mg/L of Mg2+. The equivalent weights are Ca2+ = 20.0 mg/meq, Mg2+ = 12.2 mg/meq, and CaCO3 = 50.0 mg/meq. The Total Hardness (TH) in mg/L as CaCO3 is most nearly:",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Ca2+", "value": 150, "color": "#3b82f6"},
            {"name": "Mg2+", "value": 98.4, "color": "#06b6d4"}
        ],
        "anions": [
            {"name": "HCO3-", "value": 150, "color": "#10b981"},
            {"name": "SO4 2-", "value": 98.4, "color": "#a855f7"}
        ],
        "hint": "Convert mg/L to mg/L as CaCO3 by multiplying by (50 / Equivalent Weight). TH = Ca Hardness + Mg Hardness.",
        "shortcut": "Ca Hardness is approx (mg/L Ca * 2.5). Mg Hardness is approx (mg/L Mg * 4.12). 60 * 2.5 + 24 * 4.12 = 150 + 98.8 = 248.8.",
        "fifthGrader": "Think of hardness as the amount of tiny rocks dissolved in the water. We are just putting all the different rocks on the same scale so we can add them up!"
    },
    {
        "id": 2002,
        "category": "Water & Wastewater Systems",
        "title": "Carbonate vs Noncarbonate Hardness",
        "description": "A water analysis shows Total Hardness = 250 mg/L as CaCO3 and Alkalinity = 180 mg/L as CaCO3. The Carbonate Hardness (CH) and Noncarbonate Hardness (NCH) in mg/L as CaCO3 are respectively most nearly:",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Ca2+", "value": 180, "color": "#3b82f6"},
            {"name": "Mg2+", "value": 70, "color": "#06b6d4"}
        ],
        "anions": [
            {"name": "HCO3- (Alkalinity)", "value": 180, "color": "#10b981"},
            {"name": "SO4 2- (NCH)", "value": 70, "color": "#a855f7"}
        ],
        "hint": "If Alkalinity < Total Hardness, then Carbonate Hardness = Alkalinity. Noncarbonate Hardness = Total Hardness - Carbonate Hardness.",
        "shortcut": "Just look at the graph! The alkalinity (green) matches up with the hardness. Any hardness hanging over the edge of the green bar is Noncarbonate (purple).",
        "fifthGrader": "Carbonate hardness is the part of the hardness that matches the alkalinity. Anything leftover is called noncarbonate!"
    },
    {
        "id": 2003,
        "category": "Water & Wastewater Systems",
        "title": "Lime Dosage for Carbonate Hardness",
        "description": "A water has a CO2 concentration of 15 mg/L as CaCO3, Ca2+ of 140 mg/L as CaCO3, Mg2+ of 60 mg/L as CaCO3, and Alkalinity of 150 mg/L as CaCO3. What is the stoichiometric lime (CaO) dose required in mg/L as CaCO3 to remove the carbonate hardness?",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Ca2+", "value": 140, "color": "#3b82f6"},
            {"name": "Mg2+", "value": 60, "color": "#06b6d4"}
        ],
        "anions": [
            {"name": "HCO3-", "value": 150, "color": "#10b981"},
            {"name": "Cl-", "value": 50, "color": "#ef4444"}
        ],
        "hint": "Lime dose = CO2 + HCO3(Alkalinity) + Mg (if removing Mg). If only removing Ca Carbonate hardness, Lime = CO2 + Alkalinity associated with Ca.",
        "shortcut": "For every molecule of bicarbonate alkalinity, you need one molecule of lime. Don't forget to add lime to destroy the free CO2 first!",
        "fifthGrader": "Lime is like a chemical sponge. We need enough sponge to soak up the CO2 gas first, and then enough to soak up the carbonate hardness."
    },
    {
        "id": 2004,
        "category": "Water & Wastewater Systems",
        "title": "Soda Ash Dosage",
        "description": "A water has Total Hardness = 300 mg/L as CaCO3 and Alkalinity = 200 mg/L as CaCO3. If all Noncarbonate Hardness (NCH) is associated with Calcium, the required Soda Ash (Na2CO3) dose in mg/L as CaCO3 to completely soften the NCH is most nearly:",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Ca2+", "value": 250, "color": "#3b82f6"},
            {"name": "Mg2+", "value": 50, "color": "#06b6d4"}
        ],
        "anions": [
            {"name": "HCO3-", "value": 200, "color": "#10b981"},
            {"name": "SO4 2- (NCH)", "value": 100, "color": "#a855f7"}
        ],
        "hint": "Soda Ash is used ONLY to remove Noncarbonate Hardness (NCH). Calculate NCH = Total Hardness - Alkalinity.",
        "shortcut": "The Soda Ash dose in mg/L as CaCO3 is exactly equal to the Noncarbonate Hardness (NCH). 300 - 200 = 100 mg/L as CaCO3.",
        "fifthGrader": "Soda ash is a special powder that only attacks 'Noncarbonate' rocks. We just measure how much noncarbonate rock is in the water and add that exact amount of powder!"
    },
    {
        "id": 2005,
        "category": "Water & Wastewater Systems",
        "title": "Excess Lime Softening (Magnesium Removal)",
        "description": "To precipitate Magnesium during softening, the pH must be raised to around 11.0. This requires an 'excess lime' dose. If the total Mg2+ is 80 mg/L as CaCO3, and the standard excess lime dose is 35 mg/L as CaCO3, the total lime required for Mg removal (excluding CO2 and HCO3) is:",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Ca2+", "value": 120, "color": "#3b82f6"},
            {"name": "Mg2+", "value": 80, "color": "#06b6d4"}
        ],
        "anions": [
            {"name": "HCO3-", "value": 150, "color": "#10b981"},
            {"name": "Cl-", "value": 50, "color": "#ef4444"}
        ],
        "hint": "Lime required for Mg removal = Mg2+ concentration + Excess Lime.",
        "shortcut": "Magnesium is stubborn! It requires 1 part lime to react with the alkalinity, 1 part lime to precipitate the Mg, PLUS an extra 35 mg/L to drive the pH to 11.",
        "fifthGrader": "Magnesium rocks only melt when the water is super basic (pH 11). We have to add extra 'excess' lime just to push the pH up high enough!"
    },
    {
        "id": 2006,
        "category": "Water & Wastewater Systems",
        "title": "Ion Exchange Softening Capacity",
        "description": "An ion exchange softener has a resin capacity of 20 kilograins per cubic foot (kgr/ft3). The resin volume is 50 ft3. The raw water has a hardness of 300 mg/L as CaCO3. What is the maximum volume of water (gallons) that can be softened before regeneration?",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Hardness (Ca+Mg)", "value": 300, "color": "#3b82f6"}
        ],
        "anions": [
            {"name": "Total Anions", "value": 300, "color": "#10b981"}
        ],
        "hint": "1 grain per gallon (gpg) = 17.1 mg/L. Total Capacity (grains) = Volume * Capacity. Gallons = Total Capacity / Hardness (in gpg).",
        "shortcut": "Convert 300 mg/L to grains per gallon: 300 / 17.1 = 17.5 gpg. Total grains = 20,000 * 50 = 1,000,000. 1,000,000 / 17.5 = 57,142 gallons.",
        "fifthGrader": "Think of the resin like a sponge that can hold exactly 1,000,000 pieces of dirt. If every gallon of water has 17.5 pieces of dirt, how many gallons until the sponge is full?"
    },
    {
        "id": 2007,
        "category": "Water & Wastewater Systems",
        "title": "Softened Water Blending (Bypass)",
        "description": "A treatment plant must deliver water with a hardness of 100 mg/L. The raw water has a hardness of 350 mg/L, and the ion exchange softener reduces hardness to 10 mg/L. What percentage of the flow should bypass the softener?",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Bypass (350 mg/L)", "value": 26.5, "color": "#f59e0b"},
            {"name": "Softened (10 mg/L)", "value": 73.5, "color": "#3b82f6"}
        ],
        "anions": [
            {"name": "Target (100 mg/L)", "value": 100, "color": "#10b981"}
        ],
        "hint": "Use the mass balance equation: Q_total * C_target = Q_bypass * C_raw + Q_soft * C_soft. Let Q_total = 1.",
        "shortcut": "Bypass Fraction = (Target - Softened) / (Raw - Softened). (100 - 10) / (350 - 10) = 90 / 340 = 26.5%.",
        "fifthGrader": "If you mix super salty water with pure water, you get medium salty water. We are just using math to figure out the perfect recipe for the mix!"
    },
    {
        "id": 2008,
        "category": "Water & Wastewater Systems",
        "title": "Equivalent Weight Conversion",
        "description": "A water sample has 96 mg/L of Sulfate (SO4 2-). The atomic weights are S=32.1, O=16.0. The equivalent weight of CaCO3 is 50.0 g/eq. What is the Sulfate concentration in mg/L as CaCO3?",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Total Cations", "value": 100, "color": "#3b82f6"}
        ],
        "anions": [
            {"name": "SO4 2- (as CaCO3)", "value": 100, "color": "#a855f7"}
        ],
        "hint": "Molecular weight of SO4 = 32.1 + 4(16) = 96.1 g/mol. Charge is 2, so Equivalent Weight = 96.1 / 2 = 48.05 g/eq. Multiply mg/L by (50 / 48.05).",
        "shortcut": "The equivalent weight of Sulfate is roughly 48. Since 96 / 48 = 2 meq/L. Multiply by 50 to get 100 mg/L as CaCO3.",
        "fifthGrader": "Scientists like to measure everything using the exact same ruler (CaCO3). We are just converting Sulfate's weight into the universal ruler's weight!"
    },
    {
        "id": 2009,
        "category": "Water & Wastewater Systems",
        "title": "Alkalinity Relationships",
        "description": "A water sample has a pH of 10.2. The Phenolphthalein alkalinity (P) is 40 mg/L as CaCO3 and the Total alkalinity (T) is 120 mg/L as CaCO3. The concentration of Carbonate (CO3 2-) alkalinity is most nearly:",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Total Cations", "value": 120, "color": "#3b82f6"}
        ],
        "anions": [
            {"name": "CO3 2-", "value": 80, "color": "#f59e0b"},
            {"name": "HCO3-", "value": 40, "color": "#10b981"}
        ],
        "hint": "Check the Alkalinity Relationship Table. If P < 1/2 T, then Carbonate = 2*P and Bicarbonate = T - 2P.",
        "shortcut": "P = 40, T = 120. Since 40 is less than half of 120, Carbonate is 2 * P = 80 mg/L as CaCO3.",
        "fifthGrader": "Alkalinity comes in three flavors: Hydroxide, Carbonate, and Bicarbonate. Depending on the pH, we can figure out exactly how much of each flavor is in the water!"
    },
    {
        "id": 2010,
        "category": "Water & Wastewater Systems",
        "title": "Split Treatment Softening",
        "description": "In a split treatment softening process, a portion of the raw water bypasses the first stage (excess lime) and is mixed with the first stage effluent in the second stage. The primary purpose of this bypassed flow is to:",
        "implemented": True,
        "component": "HardnessVisualizer",
        "cations": [
            {"name": "Raw Water Mg2+", "value": 150, "color": "#06b6d4"},
            {"name": "Softened Water Mg2+", "value": 40, "color": "#3b82f6"}
        ],
        "anions": [
            {"name": "Alkalinity", "value": 190, "color": "#10b981"}
        ],
        "hint": "The first stage operates at pH 11 to drop out Mg. The bypassed raw water contains HCO3- and CO2, which naturally lowers the pH and provides carbonate to react with excess Ca.",
        "shortcut": "Bypassing raw water saves money! You don't need as much CO2 for recarbonation because the raw water naturally neutralizes the high pH of the first stage.",
        "fifthGrader": "Instead of adding expensive acid to fix the super basic water from the first tank, we just mix in some normal raw water. It naturally cools off the chemicals and saves money!"
    }
]

problems.extend(new_problems)

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(problems, f, indent=2)

print("Successfully added 10 Hardness problems to problems.json")
