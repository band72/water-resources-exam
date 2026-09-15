// Standardized Category Resolver
export function getProblemCategory(prob) {
  let cat = prob.category || 'General Engineering';
  if (cat === 'PE Exam Topic' || cat === 'Uncategorized' || !prob.category) {
    const desc = (prob.description || '').toLowerCase();
    if (desc.includes('cost') || desc.includes('budget') || desc.includes('labor') || desc.includes('depreciation') || desc.includes('cpm') || desc.includes('duration')) {
      return 'Project Planning & Economics';
    } else if (desc.includes('soil') || desc.includes('footing') || desc.includes('clay') || desc.includes('sand') || desc.includes('consolidation') || desc.includes('settlement') || desc.includes('bearing') || desc.includes('earth pressure')) {
      return 'Soil Mechanics & Foundations';
    } else if (desc.includes('beam') || desc.includes('steel') || desc.includes('timber') || desc.includes('concrete') || desc.includes('load') || desc.includes('moment') || desc.includes('tension') || desc.includes('slab')) {
      return 'Structural Mechanics';
    } else if (desc.includes('pipe') || desc.includes('flow') || desc.includes('water') || desc.includes('pump') || desc.includes('channel') || desc.includes('runoff') || desc.includes('rainfall') || desc.includes('weir')) {
      return 'Hydraulics & Hydrology';
    } else if (desc.includes('wastewater') || desc.includes('bod') || desc.includes('effluent') || desc.includes('sludge') || desc.includes('treatment') || desc.includes('drinking')) {
      return 'Water & Wastewater Systems';
    } else if (desc.includes('curve') || desc.includes('sight distance') || desc.includes('station') || desc.includes('highway') || desc.includes('traffic')) {
      return 'Transportation & Geometrics';
    }
    return 'General Engineering';
  }

  if (cat === 'Quantity Estimating' || cat === 'Engineering Economics' || cat === 'Project Planning') return 'Project Planning & Economics';
  if (cat === 'Timber Design' || cat === 'Steel Design' || cat === 'Foundation Design') return 'Structural Mechanics';
  if (cat === 'Hydraulics') return 'Hydraulics & Hydrology';
  return cat;
}
