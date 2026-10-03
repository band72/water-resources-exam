import { renderMath } from './renderMath';

/** <MathText text="R^(2/3)" />  or  <MathText>{'Q_AB^{(1)}'}</MathText> */
const MathText = ({ text, children }) => {
  const value = text ?? children;
  if (typeof value !== 'string') return value ?? null;
  return <>{renderMath(value)}</>;
};

export default MathText;
