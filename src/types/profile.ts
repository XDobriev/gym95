export type Goal = 'lose' | 'gain' | 'regular';
export type Sex = 'male' | 'female';

export interface Profile {
  user_id: number;
  goal: Goal;
  sex: Sex;
  birth_year: number;
  height_cm: number;
  timezone: string;
  invited_by: number | null;
  onboarded_at: string;
  created_at: string;
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose: '📉 Похудеть',
  gain: '💪 Набрать мышцы',
  regular: '🔁 Регулярность и форма',
};

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Мужской',
  female: 'Женский',
};
