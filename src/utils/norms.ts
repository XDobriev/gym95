const ML_PER_KG = 30;
const MIN_ML = 1500;
const MAX_ML = 3000;
const STEP_ML = 250;
const IDEAL_BMI = 22;
const EXCESS_FACTOR = 0.4; // жировой ткани вода почти не нужна — учитываем 40% лишнего веса

// Суточная норма питья в мл. При весе выше «идеального» (ИМТ 22) считаем от
// приведённого веса, иначе правило 30 мл/кг даёт 4+ литра при большом весе.
export function waterNormMl(p: { heightCm: number; weightKg: number }): number {
  const h = p.heightCm / 100;
  const ideal = IDEAL_BMI * h * h;
  const effective = p.weightKg > ideal ? ideal + EXCESS_FACTOR * (p.weightKg - ideal) : p.weightKg;
  const rounded = Math.round((ML_PER_KG * effective) / STEP_ML) * STEP_ML;
  return Math.min(MAX_ML, Math.max(MIN_ML, rounded));
}

export function formatLiters(ml: number): string {
  return `${(ml / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} л`;
}
