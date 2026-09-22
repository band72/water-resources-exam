#!/usr/bin/env python3
import os
import json
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_META = os.path.join(DATA_DIR, "raw_metadata.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "problems.json")

def clean_sentence(s):
    s = s.strip()
    if not s:
        return ""
    # Capitalize first letter
    s = s[0].upper() + s[1:]
    # Replace common speech errors or units
    s = re.sub(r"\bft\s+squared\b", "ft²", s, flags=re.IGNORECASE)
    s = re.sub(r"\bft\s+cubed\b", "ft³", s, flags=re.IGNORECASE)
    s = re.sub(r"\bcfs\b", "CFS (ft³/s)", s, flags=re.IGNORECASE)
    s = re.sub(r"\bmgd\b", "MGD", s, flags=re.IGNORECASE)
    s = re.sub(r"\bgpm\b", "GPM", s, flags=re.IGNORECASE)
    s = re.sub(r"\bpe\s+exam\b", "PE Exam", s, flags=re.IGNORECASE)
    s = re.sub(r"\bncees\b", "NCEES", s, flags=re.IGNORECASE)
    s = re.sub(r"\[music\]", "", s, flags=re.IGNORECASE)
    if not s.endswith((".", "?", "!")):
        s += "."
    return s

def categorize_problem(title, topic, transcript):
    title_topic = (title + " " + topic).lower()
    text = (title + " " + topic + " " + transcript[:600]).lower()
    
    # 0. Check Civil Breadth titles (#51-#80)
    parts = title.split("|")
    disc = parts[0].split(":")[-1].strip() if len(parts) > 1 else ""
    if "Transportation" in disc or any(k in title_topic for k in ["vertical curve", "horizontal curve", "traffic counts"]):
        return "Transportation"
    elif "Soil Mechanics" in disc:
        return "Geotechnical & Soils"
    elif "Structural Mechanics" in disc:
        return "Structural Mechanics"
    elif any(k in disc for k in ["Project Planning", "Site Development", "Means and Methods"]):
        return "Construction & Project Planning"
    elif "Materials" in disc:
        if "concrete" in title_topic:
            return "Structural Mechanics"
        return "Geotechnical & Soils"

    # Explicit title overrides first for Wastewater
    if any(k in title_topic for k in ["wastewater", "waste water", "sludge", "digester", "bod5", "aeration tank", "sewer capacity", "sewer design", "equivalent sewer", "partial flows"]):
        return "Wastewater Treatment"
    if any(k in text for k in ["wastewater", "waste water", "activated sludge", "sludge sample", "aerobic digester", "anaerobic digester", "streeter", "bod5", "volatile solids", "sewer capacity", "sewer design", "equivalent sewer", "partial flows"]):
        return "Wastewater Treatment"
    if any(k in text for k in ["clarifier", "rapid mix", "media filtration", "dual media", "softening", "excess lime", "ion exchange", "chlorine dose", "chlorine demand", "uv disinfection", "drinking water", "water supply", "hardness", "water quality", "flocculat", "coagulat"]):
        return "Water Treatment"
    if any(k in text for k in ["aquifer", "transmissivity", "hydraulic conductivity", "pumping well", "thiem", "confined", "unconfined", "groundwater"]):
        return "Groundwater & Wells"
    if any(k in text for k in ["rational method", "runoff", "time of concentration", "idf curve", "hyetograph", "hydrologic budget", "detention basin", "peak flow", "peak runoff", "multiple basins", "overland flow", "stormwater"]):
        return "Hydrology & Stormwater"
    if any(k in text for k in ["manning", "open channel", "weir", "orifice", "discharge coefficient", "friction factor", "moody", "darcy", "hazen", "hardy cross", "pipe flow", "pump head", "centrifugal pump", "sluice gate", "froude", "hydraulic jump", "critical depth", "bernoulli", "velocity head", "energy equation"]):
        return "Hydraulics & Pipe Flow"
    # Transportation (Civil Breadth)
    if any(k in text for k in ["vertical curve", "horizontal curve", "traffic count", "daily volume", "transportation", "sight distance", "degree of curve"]):
        return "Transportation"
    # Geotechnical & Soils (Civil Breadth)
    if any(k in text for k in ["retaining wall", "rankine", "pore pressure", "settlement", "standard penetration", "spt", "uscs", "aashto", "soil mechanics", "vertical stress", "dry unit weight", "soil properties", "slope stability"]):
        return "Geotechnical & Soils"
    # Structural Mechanics (Civil Breadth)
    if any(k in text for k in ["simply supported beam", "bending moment", "0 force member", "zero force member", "zero-force", "truss", "shear and moment", "steel failure", "structural loads", "point load vs distributed"]):
        return "Structural Mechanics"
    # Construction & Project Planning (Civil Breadth)
    if any(k in text for k in ["cut and fill", "earthwork", "critical path", "cpm", "construction loads", "construction geometry", "cost estimating", "depreciation", "budgeting", "safety (osha)", "project planning", "site development"]):
        return "Construction & Project Planning"
    if any(k in text for k in ["economic", "present worth", "capital recovery", "cost-benefit"]):
        return "Engineering Economics"
    if any(k in text for k in ["landfill", "leachate", "hazard index", "noael", "dwel", "reference dose", "air emission", "pohc", "incinerat", "cyclone", "combustion efficiency", "radioactivity", "soil contamination", "chemical mass balance", "radiation intensity"]):
        return "Environmental Engineering"
    return "Water Resources"

def extract_problem_statement(transcript):
    if not transcript:
        return "Refer to the video presentation for the illustrated problem diagram and statement."
    
    split_patterns = [
        r"(?:so\s+)?this\s+problem\s+(?:doesn'?t\s+require|requires|is\s+about|is\s+asking|gives\s+us|is\s+fairly)",
        r"(?:so\s+)?let'?s\s+get\s+started",
        r"for\s+step\s+(?:one|1)",
        r"step\s+(?:one|1)\s*:",
        r"step\s+(?:one|1)\s+",
        r"now\s+how\s+do\s+we\s+solve\s+this",
        r"now\s+to\s+solve\s+this",
        r"the\s+first\s+step",
        r"so\s+over\s+here\s+is\s+the\s+given\s+(?:diagram|pipe|figure|channel)",
        r"normally\s+i\s+would\s+start\s+by",
        r"let'?s\s+start\s+by"
    ]
    
    parts = re.split("|".join(split_patterns), transcript, maxsplit=1, flags=re.IGNORECASE)
    stmt = parts[0].strip()
    
    stmt = re.sub(r"^\[Music\]\s*", "", stmt, flags=re.IGNORECASE)
    stmt = re.sub(r"^(?:okay\s+|alright\s+|so\s+)?in\s+this\s+problem\s*,?\s*", "", stmt, flags=re.IGNORECASE)
    stmt = re.sub(r"^(?:welcome\s+to\s+solved\s+in\s+6\s*,?\s*)", "", stmt, flags=re.IGNORECASE)
    
    if len(stmt) < 35 and len(transcript) > 60:
        # Fallback to first 2-3 sentences
        sentences = re.split(r"(?<=[.?!])\s+", transcript)
        stmt = " ".join(sentences[:2]) if len(sentences) >= 2 else transcript[:250]
        
    return clean_sentence(stmt)

def extract_solution_steps(transcript, segments, topic, category):
    steps = []
    
    # 1. Try finding explicit steps
    step_markers = list(re.finditer(r"(?:for\s+)?step\s+([1-9]|one|two|three|four|five|six|seven)\b", transcript, re.IGNORECASE))
    num_map = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7}
    
    if step_markers and len(step_markers) >= 2:
        for i, match in enumerate(step_markers):
            start_idx = match.start()
            end_idx = step_markers[i+1].start() if i + 1 < len(step_markers) else len(transcript)
            step_text = transcript[start_idx:end_idx].strip()
            
            raw_num = match.group(1).lower()
            step_num = int(raw_num) if raw_num.isdigit() else num_map.get(raw_num, i+1)
            
            # Timestamp lookup
            matched_time = "00:00"
            for seg in segments:
                if match.group(0).lower() in seg.get("text", "").lower():
                    matched_time = seg.get("timestamp", "00:00")
                    break
            
            title_match = re.search(r"step\s+\w+[\s:]+(?:we\s+can\s+|let'?s\s+|to\s+)?([^.!?\n]{5,55})", step_text, re.IGNORECASE)
            title = title_match.group(1).strip().capitalize() if title_match else f"Step {step_num} Calculation"
            
            math_formula = infer_math_formula(step_text, topic, category)
            
            steps.append({
                "step_number": step_num,
                "title": f"Step {step_num}: {title}",
                "timestamp": matched_time,
                "math_formula": math_formula,
                "explanation": clean_sentence(step_text[:400])
            })
    else:
        # 2. Heuristic extraction based on logical transitions
        transition_patterns = [
            (r"(?:first(?:\s+thing|\s+step)?|let'?s\s+start|to\s+start|we\s+can\s+start)", "Identify Governing Equations & Given Data"),
            (r"(?:next|from\s+there|after\s+that|second)", "Intermediate Calculations & Variable Substitution"),
            (r"(?:then|substituting|solving\s+for)", "Solve for Target Parameter"),
            (r"(?:finally|lastly|which\s+gives\s+us|in\s+conclusion)", "Final Calculation & Unit Verification")
        ]
        
        found_splits = []
        for pat, fallback_title in transition_patterns:
            m = re.search(pat, transcript, re.IGNORECASE)
            if m:
                found_splits.append((m.start(), fallback_title, m.group(0)))
                
        found_splits.sort(key=lambda x: x[0])
        
        if len(found_splits) >= 2:
            for i, (idx, fallback_title, matched_text) in enumerate(found_splits):
                next_idx = found_splits[i+1][0] if i + 1 < len(found_splits) else len(transcript)
                chunk = transcript[idx:next_idx].strip()
                
                # Timestamp
                matched_time = "00:00"
                for seg in segments:
                    if matched_text.lower() in seg.get("text", "").lower():
                        matched_time = seg.get("timestamp", "00:00")
                        break
                        
                math_formula = infer_math_formula(chunk, topic, category)
                steps.append({
                    "step_number": i + 1,
                    "title": f"Step {i + 1}: {fallback_title}",
                    "timestamp": matched_time,
                    "math_formula": math_formula,
                    "explanation": clean_sentence(chunk[:400])
                })
        else:
            # 3. Fallback: divide transcript into 3 structured steps using segments or words
            step_titles = [
                "Problem Setup & Given Parameters",
                "Core Governing Equation & Calculations",
                "Final Unit Conversions & Solution"
            ]
            
            if segments and len(segments) >= 6:
                n_segs = len(segments)
                c1 = n_segs // 3
                c2 = 2 * n_segs // 3
                chunks = [
                    (" ".join([s.get("text", "") for s in segments[:c1]]), step_titles[0], segments[0].get("timestamp", "00:00")),
                    (" ".join([s.get("text", "") for s in segments[c1:c2]]), step_titles[1], segments[c1].get("timestamp", "00:00")),
                    (" ".join([s.get("text", "") for s in segments[c2:]]), step_titles[2], segments[c2].get("timestamp", "00:00"))
                ]
                for i, (txt, stitle, t_time) in enumerate(chunks):
                    steps.append({
                        "step_number": i + 1,
                        "title": f"Step {i + 1}: {stitle}",
                        "timestamp": t_time,
                        "math_formula": infer_math_formula(txt, topic, category),
                        "explanation": clean_sentence(txt[:400])
                    })
            elif transcript:
                words = transcript.split()
                w_per_step = max(1, len(words) // 3)
                for i in range(3):
                    chunk_words = words[i * w_per_step : (i + 1) * w_per_step] if i < 2 else words[i * w_per_step :]
                    txt = " ".join(chunk_words)
                    steps.append({
                        "step_number": i + 1,
                        "title": f"Step {i + 1}: {step_titles[i]}",
                        "timestamp": "00:00",
                        "math_formula": infer_math_formula(txt, topic, category),
                        "explanation": clean_sentence(txt[:400])
                    })

    return steps

def infer_math_formula(text, topic, category):
    t = (text + " " + topic + " " + category).lower()
    
    if "clarifier" in t and ("detention" in t or "retention" in t or "volume" in t):
        return r"t = \frac{V}{Q}, \quad Q = v \cdot A"
    elif "manning" in t:
        return r"Q = \frac{1.49}{n} A R_h^{2/3} S^{1/2} \quad \text{(USCS)}"
    elif "moody" in t or "friction" in t or "darcy" in t:
        return r"h_f = f \frac{L}{D} \frac{v^2}{2g}"
    elif "hazen" in t or "hardy cross" in t:
        return r"h_f = 4.73 \frac{L}{C^{1.852} D^{4.87}} Q^{1.852}, \quad \Delta Q = -\frac{\sum h_f}{1.852 \sum (h_f / Q)}"
    elif "thiem" in t or ("aquifer" in t and "confined" in t):
        return r"Q = \frac{2 \pi T (h_2 - h_1)}{\ln(r_2 / r_1)}, \quad T = K \cdot b"
    elif "aquifer" in t and "unconfined" in t:
        return r"Q = \frac{\pi K (h_2^2 - h_1^2)}{\ln(r_2 / r_1)}"
    elif "v notch" in t or "v-notch" in t:
        return r"Q = \frac{8}{15} C_d \sqrt{2g} \tan(\theta/2) H^{5/2} \approx 2.5 \tan(\theta/2) H^{2.5}"
    elif "weir" in t:
        return r"Q = C_w L H^{3/2} = \frac{2}{3} C_d \sqrt{2g} L H^{3/2}"
    elif "orifice" in t or "discharge coefficient" in t:
        return r"Q = C_d A \sqrt{2g h}"
    elif "rational" in t or "runoff" in t or "peak flow" in t:
        return r"Q = C \cdot I \cdot A \quad (\text{CFS} \approx \text{in/hr} \times \text{acres})"
    elif "bod" in t:
        return r"\text{BOD}_t = \text{BOD}_L (1 - e^{-k t})"
    elif "streeter" in t or "dissolved oxygen" in t:
        return r"D = \frac{k_1 L_0}{k_2 - k_1} (e^{-k_1 t} - e^{-k_2 t}) + D_0 e^{-k_2 t}"
    elif "froude" in t or "hydraulic jump" in t:
        return r"Fr = \frac{v}{\sqrt{g y_h}}, \quad \frac{y_2}{y_1} = \frac{1}{2}\left(\sqrt{1 + 8 Fr_1^2} - 1\right)"
    elif "pump" in t or "head" in t:
        return r"\text{WHP} = \frac{Q \cdot \gamma \cdot H}{550}, \quad \text{BHP} = \frac{\text{WHP}}{\eta}"
    elif "hardness" in t or "softening" in t:
        return r"\text{Total Hardness} = [\text{Ca}^{2+}] + [\text{Mg}^{2+}] \quad (\text{as mg/L } \text{CaCO}_3)"
    elif "chlorine" in t:
        return r"\text{Chlorine Dose} = \text{Chlorine Demand} + \text{Free Residual}"
    elif "mass balance" in t or "dilution" in t:
        return r"C_m = \frac{Q_1 C_1 + Q_2 C_2}{Q_1 + Q_2}"
    elif "present worth" in t:
        return r"P = F(1+i)^{-n} = F(P/F, i\%, n)"
    elif "capital recovery" in t:
        return r"A = P \left[\frac{i(1+i)^n}{(1+i)^n - 1}\right] = P(A/P, i\%, n)"
    elif "half-life" in t or "decay" in t:
        return r"C(t) = C_0 e^{-k t}, \quad t_{1/2} = \frac{\ln 2}{k}"
    elif "hazard index" in t or "noael" in t:
        return r"\text{RfD} = \frac{\text{NOAEL}}{\text{UF} \times \text{MF}}, \quad \text{HQ} = \frac{\text{Intake}}{\text{RfD}}"
    elif "vertical curve" in t or "tangent slope" in t:
        return r"y = \frac{A}{200L} x^2 + g_1 x + \text{Elev}_{VPC}, \quad \text{Slope} = \frac{dy}{dx} = \frac{g_2 - g_1}{L} x + g_1, \quad K = \frac{L}{|A|}"
    elif "horizontal curve" in t or "degree of curve" in t:
        return r"R = \frac{5729.58}{D}, \quad T = R \tan\left(\frac{\Delta}{2}\right), \quad L = R \Delta \frac{\pi}{180}, \quad \text{PT} = \text{PC} + L"
    elif "traffic count" in t or "daily volume" in t or "adt" in t:
        return r"\text{ADT} = \frac{\text{Total Volume}}{\text{Number of Days}}, \quad \text{AADT} = \text{ADT} \times \text{Seasonal Factor}"
    elif "vertical stress" in t:
        return r"\sigma_v = \sum \gamma_i h_i, \quad \sigma_v' = \sigma_v - u"
    elif "dry unit weight" in t or ("unit weight" in t and "soil" in t):
        return r"\gamma_d = \frac{\gamma}{1 + w} = \frac{G_s \gamma_w}{1 + e}"
    elif "pore pressure" in t:
        return r"u = \gamma_w \cdot h_w, \quad \sigma' = \sigma - u"
    elif "rankine" in t or "retaining wall" in t or "earth pressure" in t:
        return r"K_a = \tan^2\left(45^\circ - \frac{\phi}{2}\right), \quad P_a = \frac{1}{2} K_a \gamma H^2"
    elif "bending moment" in t or "simply supported beam" in t:
        return r"M_{\max} = \frac{w L^2}{8} \quad (\text{uniform load}), \quad M_{\max} = \frac{P L}{4} \quad (\text{center point load})"
    elif "truss" in t or "0 force" in t or "zero force" in t:
        return r"\sum F_x = 0, \quad \sum F_y = 0, \quad \sum M = 0"
    elif "shear" in t and "moment" in t:
        return r"V = \frac{dM}{dx}, \quad \Delta M = \int V \, dx"
    elif "cut and fill" in t or "earthwork" in t:
        return r"V = \frac{A_1 + A_2}{2} L \quad (\text{Average End Area Method})"
    elif "critical path" in t or "cpm" in t:
        return r"\text{ES} + \text{Duration} = \text{EF}, \quad \text{Float} = \text{LS} - \text{ES} = \text{LF} - \text{EF}"
    elif "depreciation" in t:
        return r"D_t = \frac{C - S}{n} \quad (\text{Straight Line}), \quad \text{BV}_t = C - t \cdot D"
    return ""

def extract_final_answer(transcript):
    if not transcript:
        return "Computed in video walkthrough"
    
    # Focus search on the latter portion (last 50%) of the transcript where conclusion and answers are stated
    n = len(transcript)
    search_portion = transcript[int(n * 0.45):] if n > 300 else transcript
    
    patterns = [
        r"(?:closest\s+answer\s+(?:over\s+here\s+)?(?:is|going\s+to\s+be|would\s+be)\s+)([^.,\n]{1,40})",
        r"(?:answer\s+to\s+our\s+problem\s+(?:and\s+if\s+we\s+look\s+over\s+here\s+the\s+closest\s+answer\s+is\s+)?)([^.,\n]{1,35})",
        r"(?:answer\s+(?:is|would\s+be|solves\s+out\s+to\s+be|comes\s+out\s+to\s+be|is\s+going\s+to\s+be)\s+)([^.,\n]{1,40})",
        r"(?:total\s+(?:travel\s+)?time\s+is\s+going\s+to\s+take\s+about\s+)([^.,\n]{1,40})",
        r"(?:find\s+that\s+[a-zA-Z]\s*=\s*)([^.,\n]{1,35})",
        r"(?:gives?\s+(?:us\s+)?(?:about\s+)?)([\d.,]+\s*[a-zA-Z/²³^%-]+)",
        r"(?:our\s+answer\s+(?:over\s+here\s+)?(?:is|could\s+be)\s+)([^.,\n]{1,35})",
        r"(?:closest\s+to\s+)([\d.,]+\s*[a-zA-Z/²³^%-]+)"
    ]
    for pat in patterns:
        m = re.search(pat, search_portion, re.IGNORECASE)
        if m:
            ans = m.group(1).strip()
            ans = re.sub(r"\s+(and|so|which|which\s+is|over|or|as|now|if|but).*$", "", ans, flags=re.IGNORECASE)
            ans = clean_sentence(ans)
            if len(ans) >= 2 and not any(w in ans.lower() for w in ["problem", "question", "manual", "equation", "diagram"]):
                return ans
    return "Refer to detailed calculation steps."

def extract_takeaways(transcript):
    if not transcript:
        return "Double check units, reference manual equations, and problem constraints."
    
    patterns = [
        r"(?:the\s+important\s+thing\s+to\s+(?:recognize|remember|note)\s+here\s+is\s+)([^.!\n]{10,250})",
        r"(?:the\s+key\s+takeaway\s+(?:here\s+)?is\s+)([^.!\n]{10,250})",
        r"(?:on\s+the\s+pe\s+exam\s*,?\s+)([^.!\n]{10,250})",
        r"(?:be\s+careful\s+(?:with|about)\s+)([^.!\n]{10,250})"
    ]
    for pat in patterns:
        m = re.search(pat, transcript, re.IGNORECASE)
        if m:
            return clean_sentence(m.group(1).strip())
            
    return "Pay close attention to unit conversions (CFS vs MGD vs GPM), standard reference handbook equations, and parallel vs. series configurations."

def extract_ncees_terms(title, topic, transcript):
    terms = set()
    text = (title + " " + topic + " " + transcript).lower()
    
    mapping = {
        "clarifier": "Clarifier / Sedimentation Basin Design",
        "detention time": "Detention Time / Hydraulic Retention Time (HRT)",
        "manning": "Manning's Equation / Open Channel Flow",
        "moody": "Moody Diagram / Darcy-Weisbach Friction Factor",
        "friction factor": "Pipe Friction Loss / Darcy-Weisbach",
        "darcy": "Darcy-Weisbach Equation",
        "weir": "Sharp-Crested & V-Notch Weirs",
        "orifice": "Orifice Flow / Discharge Coefficient",
        "rational": "Rational Method / Runoff Coefficient (C)",
        "idf": "IDF Curves / Rainfall Intensity",
        "aquifer": "Aquifers / Confined vs. Unconfined Flow",
        "thiem": "Thiem Equation / Well Drawdown",
        "transmissivity": "Transmissivity (T = K * b)",
        "hydraulic conductivity": "Hydraulic Conductivity (K)",
        "bod5": "BOD5 / Ultimate BOD / Kinetic Decay",
        "streeter": "Streeter-Phelps Dissolved Oxygen Sag",
        "sludge": "Activated Sludge / Solids Retention Time",
        "chlorine": "Chlorine Dosage = Demand + Residual",
        "hardness": "Water Hardness / Lime-Soda Softening",
        "pump": "Pump Power & Efficiency (HP = Q*gamma*h / 550*eta)",
        "froude": "Froude Number & Hydraulic Jumps",
        "bernoulli": "Energy Equation / Velocity Head",
        "present worth": "Engineering Economics / Present Worth Factor (P/F, P/A)",
        "capital recovery": "Capital Recovery Factor (A/P, i, n)",
        "noael": "NOAEL / Reference Dose (RfD) / DWEL",
        "leachate": "Landfill Leachate / Clay Liner Breakthrough Time",
        "first-order": "First-Order Decay / Half-Life",
        "vertical curve": "Vertical Curves / K-value / Tangent Elevation",
        "horizontal curve": "Horizontal Curves / Degree of Curve / PT = PC + L",
        "traffic": "Traffic Volume / ADT / Design Hourly Volume",
        "retaining wall": "Retaining Walls / Rankine Earth Pressure",
        "beam": "Beams / Bending Moment / Shear & Moment Diagrams",
        "truss": "Truss Analysis / Zero-Force Members",
        "soil": "Soil Mechanics / USCS & AASHTO / Phase Relationships",
        "cut and fill": "Earthwork / Cut & Fill / Average End Area",
        "critical path": "Project Planning / Critical Path Method (CPM)",
        "depreciation": "Engineering Economics / Straight-Line Depreciation"
    }
    
    for k, v in mapping.items():
        if k in text:
            terms.add(v)
            
    if not terms:
        terms.add("NCEES Civil PE Reference Handbook")
        
    return sorted(list(terms))

def main():
    if not os.path.exists(RAW_META):
        print(f"Error: {RAW_META} does not exist!")
        return

    with open(RAW_META, "r", encoding="utf-8") as f:
        raw_items = json.load(f)

    print(f"Loaded {len(raw_items)} raw video metadata entries.")
    
    problems = []
    
    for item in raw_items:
        vid = item["id"]
        full_title = item.get("title", "")
        transcript = item.get("plain_transcript", "")
        segments = item.get("segments", [])
        
        parts = full_title.split("|")
        clean_topic = parts[1].strip() if len(parts) > 1 else full_title
        clean_topic = re.sub(r"^(?:Water Resources\s*/\s*Environmental|Water Resources|Environmental|Civil Breadth)\s*[-–—]\s*", "", clean_topic, flags=re.IGNORECASE).strip()
        clean_topic = re.sub(r"^PE Exam Practice Problem #?\d+:\s*(?:Environmental|Water Resources|Transportation|Materials|Means and Methods|Project Planning|Site Development|Soil Mechanics|Structural Mechanics)?\s*[-–—|]?\s*", "", clean_topic, flags=re.IGNORECASE).strip()
        
        num_m = re.search(r"Practice Problem\s*#?(\d+)", full_title, re.IGNORECASE)
        prob_num = int(num_m.group(1)) if num_m else item.get("problem_number")
        
        category = categorize_problem(full_title, clean_topic, transcript)
        problem_stmt = extract_problem_statement(transcript)
        steps = extract_solution_steps(transcript, segments, clean_topic, category)
        final_answer = extract_final_answer(transcript)
        takeaway = extract_takeaways(transcript)
        ncees_terms = extract_ncees_terms(full_title, clean_topic, transcript)
        
        dur = item.get("duration", 0)
        dur_min = int(dur // 60)
        dur_sec = int(dur % 60)
        dur_fmt = f"{dur_min:02d}:{dur_sec:02d}"
        
        playlists = item.get("playlists", [])
        if prob_num is not None and 51 <= prob_num <= 80:
            if "Civil Breadth" not in playlists:
                playlists.append("Civil Breadth")
                
        if "Civil Breadth" in playlists or (prob_num is not None and 51 <= prob_num <= 80):
            discipline = "Civil Breadth"
        elif "Water Resources" in playlists and "Environmental" in playlists:
            discipline = "Water Resources / Environmental"
        else:
            discipline = playlists[0] if playlists else "Water Resources"
            
        # Check if local video file exists
        local_video_filename = f"{vid}.mp4"
        local_video_path = os.path.join(DATA_DIR, "videos", local_video_filename)
        has_local_video = os.path.exists(local_video_path)
        
        prob_obj = {
            "id": vid,
            "problem_number": prob_num,
            "display_number": f"Problem #{prob_num}" if prob_num else "Practice Problem",
            "title": full_title,
            "topic": clean_topic,
            "discipline": discipline,
            "playlists": playlists,
            "category": category,
            "duration": dur,
            "duration_formatted": dur_fmt,
            "problem_statement": problem_stmt,
            "ncees_search_terms": ncees_terms,
            "solution_steps": steps,
            "final_answer": final_answer,
            "key_takeaway": takeaway,
            "youtube_url": item.get("youtube_url", f"https://www.youtube.com/watch?v={vid}"),
            "embed_url": item.get("embed_url", f"https://www.youtube-nocookie.com/embed/{vid}"),
            "local_video_filename": local_video_filename,
            "has_local_video": has_local_video,
            "thumbnail": item.get("thumbnail", f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"),
            "segments_count": len(segments),
            "segments": segments,
            "plain_transcript": transcript
        }
        problems.append(prob_obj)
        
    problems.sort(key=lambda x: (x["problem_number"] if x["problem_number"] is not None else 9999, x["title"]))
    
    # Assign sequential exam numbering for each series
    wr_idx = 0
    for p in problems:
        playlists = p.get("playlists", [])
        if "Water Resources" in playlists or "Water Resources" in p.get("discipline", ""):
            wr_idx += 1
            p["wr_number"] = wr_idx
            p["wr_display"] = f"WR #{wr_idx} of 76"
        else:
            p["wr_number"] = None
            p["wr_display"] = None

    env_idx = 0
    for p in problems:
        playlists = p.get("playlists", [])
        if "Environmental" in playlists or "Environmental" in p.get("discipline", ""):
            env_idx += 1
            p["env_number"] = env_idx
            p["env_display"] = f"Env #{env_idx} of 65"
        else:
            p["env_number"] = None
            p["env_display"] = None

    breadth_idx = 0
    for p in problems:
        playlists = p.get("playlists", [])
        pnum = p.get("problem_number")
        if "Civil Breadth" in playlists or (pnum is not None and 51 <= pnum <= 80):
            breadth_idx += 1
            p["breadth_number"] = breadth_idx
            p["breadth_display"] = f"Breadth #{breadth_idx} of 30"
        else:
            p["breadth_number"] = None
            p["breadth_display"] = None

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(problems, f, indent=2, ensure_ascii=False)
        
    print(f"✓ Successfully processed and wrote {len(problems)} enriched problems to {OUTPUT_FILE} (WR: 1-{wr_idx}, Env: 1-{env_idx}, Breadth: 1-{breadth_idx})!")

if __name__ == "__main__":
    main()
