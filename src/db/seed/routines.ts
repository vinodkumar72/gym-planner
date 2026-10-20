export interface SeedTemplateExercise {
  exerciseId: string;
  sets?: number;
  minReps?: number;
  maxReps?: number;
  rest?: number;
  durationSeconds?: number;
  distance?: number;
}

export interface SeedTemplate {
  id: string;
  name: string;
  exercises: SeedTemplateExercise[];
}

export interface SeedRoutine {
  id: string;
  name: string;
  description: string;
  rotationType: 'rotation' | 'calendar';
  templates: SeedTemplate[];
  /** which goals/experience levels this routine suits (for onboarding recommendation) */
  suits: { experience: ('beginner' | 'intermediate' | 'advanced')[]; daysPerWeek: number[] };
}

const r = (exerciseId: string, sets: number, minReps: number, maxReps: number, rest = 90): SeedTemplateExercise => ({
  exerciseId,
  sets,
  minReps,
  maxReps,
  rest,
});

export const SEED_ROUTINES: SeedRoutine[] = [
  {
    id: 'rt_full_body',
    name: 'Beginner Full Body',
    description: 'Three full-body workouts per week. Ideal for building the habit and learning the main lifts.',
    rotationType: 'rotation',
    suits: { experience: ['beginner'], daysPerWeek: [2, 3] },
    templates: [
      {
        id: 'tp_full_body_a',
        name: 'Full Body A',
        exercises: [
          r('ex_squat', 3, 8, 10),
          r('ex_chest_press', 3, 8, 10),
          r('ex_lat_pulldown', 3, 8, 10),
          { exerciseId: 'ex_plank', sets: 3, durationSeconds: 30, rest: 60 },
        ],
      },
      {
        id: 'tp_full_body_b',
        name: 'Full Body B',
        exercises: [
          r('ex_leg_press', 3, 10, 12),
          r('ex_shoulder_press', 3, 8, 10),
          r('ex_seated_row', 3, 8, 10),
          r('ex_crunch', 3, 12, 15, 60),
        ],
      },
      {
        id: 'tp_full_body_c',
        name: 'Full Body C',
        exercises: [
          r('ex_goblet_squat', 3, 8, 10),
          r('ex_push_up', 3, 8, 10, 60),
          r('ex_db_row', 3, 10, 12),
          r('ex_bicep_curl', 3, 10, 12, 60),
        ],
      },
    ],
  },
  {
    id: 'rt_ppl',
    name: 'Push / Pull / Legs',
    description: 'Classic three-day split. Rotates push, pull and leg days whenever you train.',
    rotationType: 'rotation',
    suits: { experience: ['intermediate', 'advanced'], daysPerWeek: [3, 4, 5, 6] },
    templates: [
      {
        id: 'tp_ppl_push',
        name: 'Push Day',
        exercises: [
          r('ex_bench_press', 3, 8, 10, 120),
          r('ex_shoulder_press', 3, 8, 10),
          r('ex_incline_db_press', 3, 8, 10),
          r('ex_tricep_pushdown', 3, 10, 12, 60),
        ],
      },
      {
        id: 'tp_ppl_pull',
        name: 'Pull Day',
        exercises: [
          r('ex_lat_pulldown', 3, 8, 10),
          r('ex_seated_row', 3, 8, 10),
          r('ex_db_row', 3, 8, 10),
          r('ex_bicep_curl', 3, 10, 12, 60),
        ],
      },
      {
        id: 'tp_ppl_legs',
        name: 'Leg Day',
        exercises: [
          r('ex_squat', 3, 6, 8, 150),
          r('ex_leg_press', 3, 10, 12),
          r('ex_leg_curl', 3, 10, 12),
          r('ex_calf_raise', 3, 12, 15, 60),
        ],
      },
    ],
  },
  {
    id: 'rt_upper_lower',
    name: 'Upper / Lower Split',
    description: 'Four-day split alternating upper and lower body sessions with two variations of each.',
    rotationType: 'rotation',
    suits: { experience: ['intermediate', 'advanced'], daysPerWeek: [4] },
    templates: [
      {
        id: 'tp_ul_upper_a',
        name: 'Upper A',
        exercises: [r('ex_bench_press', 3, 6, 10, 120), r('ex_seated_row', 3, 8, 12), r('ex_shoulder_press', 3, 8, 12)],
      },
      {
        id: 'tp_ul_lower_a',
        name: 'Lower A',
        exercises: [r('ex_squat', 3, 6, 10, 150), r('ex_leg_curl', 3, 10, 12), r('ex_calf_raise', 3, 12, 15, 60)],
      },
      {
        id: 'tp_ul_upper_b',
        name: 'Upper B',
        exercises: [
          r('ex_incline_db_press', 3, 8, 12),
          r('ex_lat_pulldown', 3, 8, 12),
          r('ex_bicep_curl', 3, 10, 12, 60),
        ],
      },
      {
        id: 'tp_ul_lower_b',
        name: 'Lower B',
        exercises: [
          r('ex_romanian_deadlift', 3, 6, 10, 120),
          r('ex_leg_press', 3, 10, 12),
          r('ex_lunge', 3, 10, 12),
        ],
      },
    ],
  },
  {
    id: 'rt_general_fitness',
    name: 'General Fitness',
    description: 'Two full-body strength sessions plus a cardio session. Great for overall health and consistency.',
    rotationType: 'rotation',
    suits: { experience: ['beginner', 'intermediate'], daysPerWeek: [2, 3, 4] },
    templates: [
      {
        id: 'tp_gf_strength_a',
        name: 'Strength A',
        exercises: [
          r('ex_goblet_squat', 3, 10, 12),
          r('ex_push_up', 3, 8, 12, 60),
          r('ex_db_row', 3, 10, 12),
          { exerciseId: 'ex_plank', sets: 3, durationSeconds: 30, rest: 60 },
        ],
      },
      {
        id: 'tp_gf_cardio',
        name: 'Cardio',
        exercises: [{ exerciseId: 'ex_treadmill', sets: 1, durationSeconds: 1500, distance: 2, rest: 0 }],
      },
      {
        id: 'tp_gf_strength_b',
        name: 'Strength B',
        exercises: [
          r('ex_leg_press', 3, 10, 12),
          r('ex_shoulder_press', 3, 10, 12),
          r('ex_lat_pulldown', 3, 10, 12),
          r('ex_glute_bridge', 3, 12, 15, 60),
        ],
      },
    ],
  },
];
