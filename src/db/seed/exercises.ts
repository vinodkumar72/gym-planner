import type { Equipment, ExerciseType, MuscleGroup } from '@/domain/models/types';

export interface SeedExercise {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  bodyweight?: boolean;
  /** empty bar / minimum machine load in lb */
  minLoadLb?: number;
  incLb?: number;
  incKg?: number;
  instructions?: string;
}

const BAR = { minLoadLb: 45 };
// Dumbbells, cables and light barbell work move in 5 lb / 2.5 kg steps at most gyms.
const SMALL = { incLb: 5, incKg: 2.5 };
const MACHINE = { incLb: 10, incKg: 5 };

/** Built-in exercise library. IDs are stable; never rename an ID once shipped. */
export const SEED_EXERCISES: SeedExercise[] = [
  // ---- chest ----
  { id: 'ex_bench_press', name: 'Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: 'barbell', type: 'strength', ...BAR, instructions: 'Lie flat, grip slightly wider than shoulders, lower the bar to mid-chest and press up.' },
  { id: 'ex_incline_bench_press', name: 'Incline Bench Press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: 'barbell', type: 'strength', ...BAR },
  { id: 'ex_chest_press', name: 'Chest Press (Machine)', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_incline_db_press', name: 'Incline Dumbbell Press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_db_bench_press', name: 'Dumbbell Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_push_up', name: 'Push-ups', primary: 'chest', secondary: ['triceps', 'core'], equipment: 'bodyweight', type: 'strength', bodyweight: true, instructions: 'Hands under shoulders, body in a straight line, lower chest to the floor and press back up.' },
  { id: 'ex_cable_fly', name: 'Cable Fly', primary: 'chest', secondary: ['shoulders'], equipment: 'cable', type: 'strength', ...SMALL },
  { id: 'ex_db_fly', name: 'Dumbbell Fly', primary: 'chest', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_pec_deck', name: 'Pec Deck', primary: 'chest', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_dip', name: 'Dips', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  // ---- back ----
  { id: 'ex_lat_pulldown', name: 'Lat Pulldown', primary: 'back', secondary: ['biceps'], equipment: 'cable', type: 'strength', ...MACHINE, instructions: 'Grip wide, pull the bar to your upper chest while keeping the torso tall.' },
  { id: 'ex_seated_row', name: 'Seated Row', primary: 'back', secondary: ['biceps'], equipment: 'cable', type: 'strength', ...MACHINE },
  { id: 'ex_db_row', name: 'Dumbbell Row', primary: 'back', secondary: ['biceps'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_barbell_row', name: 'Barbell Row', primary: 'back', secondary: ['biceps', 'hamstrings'], equipment: 'barbell', type: 'strength', ...BAR },
  { id: 'ex_pull_up', name: 'Pull-ups', primary: 'back', secondary: ['biceps'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_chin_up', name: 'Chin-ups', primary: 'back', secondary: ['biceps'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_deadlift', name: 'Deadlift', primary: 'back', secondary: ['hamstrings', 'glutes', 'core'], equipment: 'barbell', type: 'strength', minLoadLb: 45, incLb: 10, incKg: 5 },
  { id: 'ex_tbar_row', name: 'T-Bar Row', primary: 'back', secondary: ['biceps'], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_straight_arm_pulldown', name: 'Straight-Arm Pulldown', primary: 'back', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  { id: 'ex_inverted_row', name: 'Inverted Row', primary: 'back', secondary: ['biceps'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_face_pull', name: 'Face Pull', primary: 'back', secondary: ['shoulders'], equipment: 'cable', type: 'strength', ...SMALL },
  // ---- shoulders ----
  { id: 'ex_shoulder_press', name: 'Shoulder Press', primary: 'shoulders', secondary: ['triceps'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_overhead_press', name: 'Overhead Press (Barbell)', primary: 'shoulders', secondary: ['triceps', 'core'], equipment: 'barbell', type: 'strength', ...BAR, ...SMALL },
  { id: 'ex_machine_shoulder_press', name: 'Shoulder Press (Machine)', primary: 'shoulders', secondary: ['triceps'], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_lateral_raise', name: 'Lateral Raise', primary: 'shoulders', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_front_raise', name: 'Front Raise', primary: 'shoulders', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_rear_delt_fly', name: 'Rear Delt Fly', primary: 'shoulders', secondary: ['back'], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_arnold_press', name: 'Arnold Press', primary: 'shoulders', secondary: ['triceps'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_upright_row', name: 'Upright Row', primary: 'shoulders', secondary: ['back'], equipment: 'barbell', type: 'strength', ...SMALL },
  { id: 'ex_cable_lateral_raise', name: 'Cable Lateral Raise', primary: 'shoulders', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  // ---- biceps ----
  { id: 'ex_bicep_curl', name: 'Bicep Curl', primary: 'biceps', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_barbell_curl', name: 'Barbell Curl', primary: 'biceps', secondary: [], equipment: 'barbell', type: 'strength', minLoadLb: 20, ...SMALL },
  { id: 'ex_hammer_curl', name: 'Hammer Curl', primary: 'biceps', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_cable_curl', name: 'Cable Curl', primary: 'biceps', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  { id: 'ex_preacher_curl', name: 'Preacher Curl', primary: 'biceps', secondary: [], equipment: 'machine', type: 'strength', ...SMALL },
  { id: 'ex_incline_curl', name: 'Incline Dumbbell Curl', primary: 'biceps', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_concentration_curl', name: 'Concentration Curl', primary: 'biceps', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  // ---- triceps ----
  { id: 'ex_tricep_pushdown', name: 'Tricep Pushdown', primary: 'triceps', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  { id: 'ex_overhead_tricep_ext', name: 'Overhead Tricep Extension', primary: 'triceps', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_skull_crusher', name: 'Skull Crusher', primary: 'triceps', secondary: [], equipment: 'barbell', type: 'strength', minLoadLb: 20, ...SMALL },
  { id: 'ex_close_grip_bench', name: 'Close-Grip Bench Press', primary: 'triceps', secondary: ['chest', 'shoulders'], equipment: 'barbell', type: 'strength', ...BAR },
  { id: 'ex_tricep_kickback', name: 'Tricep Kickback', primary: 'triceps', secondary: [], equipment: 'dumbbell', type: 'strength', ...SMALL },
  { id: 'ex_bench_dip', name: 'Bench Dips', primary: 'triceps', secondary: ['chest'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_rope_pushdown', name: 'Rope Pushdown', primary: 'triceps', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  // ---- quadriceps ----
  { id: 'ex_squat', name: 'Squat', primary: 'quadriceps', secondary: ['glutes', 'hamstrings', 'core'], equipment: 'barbell', type: 'strength', ...BAR, instructions: 'Bar on upper back, feet shoulder-width, sit down between your hips until thighs are at least parallel, drive up.' },
  { id: 'ex_goblet_squat', name: 'Goblet Squat', primary: 'quadriceps', secondary: ['glutes', 'core'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_leg_press', name: 'Leg Press', primary: 'quadriceps', secondary: ['glutes', 'hamstrings'], equipment: 'machine', type: 'strength', incLb: 20, incKg: 10 },
  { id: 'ex_leg_extension', name: 'Leg Extension', primary: 'quadriceps', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_front_squat', name: 'Front Squat', primary: 'quadriceps', secondary: ['glutes', 'core'], equipment: 'barbell', type: 'strength', ...BAR },
  { id: 'ex_hack_squat', name: 'Hack Squat', primary: 'quadriceps', secondary: ['glutes'], equipment: 'machine', type: 'strength', incLb: 20, incKg: 10 },
  { id: 'ex_lunge', name: 'Lunges', primary: 'quadriceps', secondary: ['glutes', 'hamstrings'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_bulgarian_split_squat', name: 'Bulgarian Split Squat', primary: 'quadriceps', secondary: ['glutes'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_bodyweight_squat', name: 'Bodyweight Squat', primary: 'quadriceps', secondary: ['glutes'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_step_up', name: 'Step-ups', primary: 'quadriceps', secondary: ['glutes'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  // ---- hamstrings ----
  { id: 'ex_leg_curl', name: 'Leg Curl', primary: 'hamstrings', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_romanian_deadlift', name: 'Romanian Deadlift', primary: 'hamstrings', secondary: ['glutes', 'back'], equipment: 'barbell', type: 'strength', ...BAR },
  { id: 'ex_db_rdl', name: 'Dumbbell Romanian Deadlift', primary: 'hamstrings', secondary: ['glutes'], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_good_morning', name: 'Good Morning', primary: 'hamstrings', secondary: ['back', 'glutes'], equipment: 'barbell', type: 'strength', ...BAR, ...SMALL },
  { id: 'ex_nordic_curl', name: 'Nordic Curl', primary: 'hamstrings', secondary: [], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_seated_leg_curl', name: 'Seated Leg Curl', primary: 'hamstrings', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  // ---- glutes ----
  { id: 'ex_hip_thrust', name: 'Hip Thrust', primary: 'glutes', secondary: ['hamstrings'], equipment: 'barbell', type: 'strength', minLoadLb: 45, incLb: 10, incKg: 5 },
  { id: 'ex_glute_bridge', name: 'Glute Bridge', primary: 'glutes', secondary: ['hamstrings', 'core'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_cable_kickback', name: 'Cable Kickback', primary: 'glutes', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  { id: 'ex_hip_abduction', name: 'Hip Abduction', primary: 'glutes', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_sumo_deadlift', name: 'Sumo Deadlift', primary: 'glutes', secondary: ['hamstrings', 'quadriceps', 'back'], equipment: 'barbell', type: 'strength', minLoadLb: 45, incLb: 10, incKg: 5 },
  { id: 'ex_kb_swing', name: 'Kettlebell Swing', primary: 'glutes', secondary: ['hamstrings', 'core'], equipment: 'kettlebell', type: 'strength', incLb: 8, incKg: 4 },
  // ---- calves ----
  { id: 'ex_calf_raise', name: 'Calf Raise', primary: 'calves', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_seated_calf_raise', name: 'Seated Calf Raise', primary: 'calves', secondary: [], equipment: 'machine', type: 'strength', ...MACHINE },
  { id: 'ex_standing_calf_raise_db', name: 'Standing Calf Raise (Dumbbell)', primary: 'calves', secondary: [], equipment: 'dumbbell', type: 'strength', incLb: 5, incKg: 2 },
  { id: 'ex_bodyweight_calf_raise', name: 'Bodyweight Calf Raise', primary: 'calves', secondary: [], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  // ---- core ----
  { id: 'ex_plank', name: 'Plank', primary: 'core', secondary: ['shoulders'], equipment: 'bodyweight', type: 'duration', bodyweight: true, instructions: 'Forearms on the floor, body straight from head to heels, brace and hold.' },
  { id: 'ex_side_plank', name: 'Side Plank', primary: 'core', secondary: [], equipment: 'bodyweight', type: 'duration', bodyweight: true },
  { id: 'ex_crunch', name: 'Crunches', primary: 'core', secondary: [], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_hanging_leg_raise', name: 'Hanging Leg Raise', primary: 'core', secondary: [], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_cable_crunch', name: 'Cable Crunch', primary: 'core', secondary: [], equipment: 'cable', type: 'strength', ...SMALL },
  { id: 'ex_russian_twist', name: 'Russian Twist', primary: 'core', secondary: [], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_ab_wheel', name: 'Ab Wheel Rollout', primary: 'core', secondary: ['back'], equipment: 'other', type: 'strength', bodyweight: true },
  { id: 'ex_dead_bug', name: 'Dead Bug', primary: 'core', secondary: [], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  { id: 'ex_mountain_climber', name: 'Mountain Climbers', primary: 'core', secondary: ['cardio'], equipment: 'bodyweight', type: 'duration', bodyweight: true },
  { id: 'ex_bird_dog', name: 'Bird Dog', primary: 'core', secondary: ['back'], equipment: 'bodyweight', type: 'strength', bodyweight: true },
  // ---- cardio ----
  { id: 'ex_treadmill', name: 'Treadmill', primary: 'cardio', secondary: [], equipment: 'cardio_machine', type: 'cardio' },
  { id: 'ex_running', name: 'Running (Outdoor)', primary: 'cardio', secondary: [], equipment: 'bodyweight', type: 'cardio' },
  { id: 'ex_walking', name: 'Walking', primary: 'cardio', secondary: [], equipment: 'bodyweight', type: 'cardio' },
  { id: 'ex_cycling', name: 'Stationary Bike', primary: 'cardio', secondary: ['quadriceps'], equipment: 'cardio_machine', type: 'cardio' },
  { id: 'ex_rowing', name: 'Rowing Machine', primary: 'cardio', secondary: ['back'], equipment: 'cardio_machine', type: 'cardio' },
  { id: 'ex_elliptical', name: 'Elliptical', primary: 'cardio', secondary: [], equipment: 'cardio_machine', type: 'cardio' },
  { id: 'ex_stair_climber', name: 'Stair Climber', primary: 'cardio', secondary: ['glutes'], equipment: 'cardio_machine', type: 'cardio' },
  { id: 'ex_jump_rope', name: 'Jump Rope', primary: 'cardio', secondary: ['calves'], equipment: 'other', type: 'cardio' },
  { id: 'ex_burpee', name: 'Burpees', primary: 'cardio', secondary: ['chest', 'quadriceps'], equipment: 'bodyweight', type: 'duration', bodyweight: true },
];
