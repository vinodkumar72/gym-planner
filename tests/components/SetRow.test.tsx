import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SetRow } from '@/components/workout/SetRow';
import type { ActiveSet } from '@/stores/workoutStore';

const set: ActiveSet = {
  id: 's1',
  sessionExerciseId: 'se1',
  setNumber: 1,
  setType: 'working',
  targetReps: 10,
  actualReps: 10,
  weight: 100,
  weightUnit: 'lb',
  durationSeconds: null,
  distance: null,
  distanceUnit: null,
  rpe: null,
  rir: null,
  completed: 0,
  completedAt: null,
};

describe('SetRow', () => {
  it('completes a set with one tap and adjusts weight/reps with steppers', async () => {
    const onToggle = jest.fn();
    const onChange = jest.fn();
    const r = await render(<SetRow set={set} kind="weighted" unit="lb" weightStep={2.5} onChange={onChange} onToggle={onToggle} />);
    await fireEvent.press(r.getByLabelText('Mark set 1 done'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await fireEvent.press(r.getByLabelText('Increase weight lb'));
    expect(onChange).toHaveBeenCalledWith({ weight: 102.5, weightUnit: 'lb' });
    await fireEvent.press(r.getByLabelText('Decrease reps'));
    expect(onChange).toHaveBeenCalledWith({ actualReps: 9 });
  });

  it('shows a checked state when completed', async () => {
    const r = await render(<SetRow set={{ ...set, completed: 1 }} kind="weighted" unit="lb" weightStep={2.5} onChange={jest.fn()} onToggle={jest.fn()} />);
    expect(r.getByLabelText('Set 1 done')).toBeTruthy();
  });

  it('renders a duration stepper for timed exercises', async () => {
    const onChange = jest.fn();
    const r = await render(
      <SetRow set={{ ...set, durationSeconds: 30, weight: null, weightUnit: null }} kind="timed" unit="lb" weightStep={2.5} onChange={onChange} onToggle={jest.fn()} />,
    );
    await fireEvent.press(r.getByLabelText('Increase seconds'));
    expect(onChange).toHaveBeenCalledWith({ durationSeconds: 35 });
  });
});
