import { describe, expect, it } from 'vitest';
import {
  lessonBlockMinutes,
  planDaily,
  PLANNER_VERSION,
  type LessonCandidate,
} from '../src/server/daily/planner';
import { studyDate } from '../src/server/daily/study-date';
import { dailyStartSchema } from '../src/lib/daily-request';

const lesson: LessonCandidate = {
  id: 'real-lesson',
  title: 'Grammar in context',
  contentVersion: 2,
  position: 1,
  estimatedMinutes: 12,
  activities: Array.from({ length: 6 }, (_, i) => ({
    focus: i === 2 ? ['grammar', 'vocabulary'] : ['grammar'],
  })),
};
const mistakes = [
  { id: 'repeated', label: 'Repeated area' },
  { id: 'active', label: 'Active area' },
  { id: 'third', label: 'Third' },
];

describe('deterministic bounded Daily planning', () => {
  it('bounds very short and very long editorial estimates and rounds up to half minutes', () => {
    expect(lessonBlockMinutes({ ...lesson, estimatedMinutes: 1 })).toBe(0.5);
    expect(lessonBlockMinutes({ ...lesson, estimatedMinutes: 13 })).toBe(2.5);
    expect(lessonBlockMinutes({ ...lesson, estimatedMinutes: 120 })).toBe(3);
  });
  it.each([5, 10, 20, 30, 45, 60])(
    'balances real work within a %i-minute goal',
    (targetMinutes) => {
      const input = { targetMinutes, dueCount: 100, lesson, mistakes };
      const plan = planDaily(input);
      expect(planDaily(input)).toEqual(plan);
      expect(
        plan.reduce((sum, i) => sum + i.estimatedMinutes, 0),
      ).toBeLessThanOrEqual(targetMinutes);
      expect(plan.map((i) => i.kind)).toContain('review');
      expect(plan.map((i) => i.kind)).toContain('mistake');
      const segment = plan.find((i) => i.kind === 'lesson')!;
      expect(segment.startPosition).toBe(1);
      expect(segment.targetPosition).toBeLessThanOrEqual(6);
      expect(segment.targetCount).toBe(segment.targetPosition! - 1);
      expect(segment.focus).toContain('grammar');
      expect(plan.filter((i) => i.kind === 'mistake')[0].weaknessId).toBe(
        'repeated',
      );
      expect(PLANNER_VERSION).toBe('daily-v1');
    },
  );
  it('uses explicit vocabulary mappings only within the selected contiguous segment', () => {
    const segment = planDaily({
      targetMinutes: 5,
      dueCount: 0,
      lesson,
      mistakes: [],
    })[0];
    expect(segment.targetPosition).toBe(3);
    expect(segment.focus).toEqual(['grammar', 'vocabulary']);
  });
  it('does not invent filler, future lessons, reviews, or mistakes', () => {
    expect(
      planDaily({ targetMinutes: 60, dueCount: 0, lesson: null, mistakes: [] }),
    ).toEqual([]);
    const cases = [
      { dueCount: 1, lesson: null, mistakes: [], kind: 'review', minutes: 0.5 },
      {
        dueCount: 0,
        lesson: null,
        mistakes: mistakes.slice(0, 1),
        kind: 'mistake',
        minutes: 2,
      },
      {
        dueCount: 0,
        lesson: { ...lesson, position: 5 },
        mistakes: [],
        kind: 'lesson',
        minutes: 2,
      },
    ];
    for (const { kind, minutes, ...input } of cases) {
      const plan = planDaily({ targetMinutes: 60, ...input });
      expect(plan).toHaveLength(1);
      expect(plan[0]).toMatchObject({ kind, estimatedMinutes: minutes });
    }
  });
  it.each([
    'userId',
    'sessionId',
    'learningLanguage',
    'targetMinutes',
    'completedMinutes',
    'completedAt',
    'sourceIds',
    'items',
    'plannerVersion',
  ])('rejects browser-supplied %s', (field) => {
    expect(dailyStartSchema.safeParse({ [field]: 'forged' }).success).toBe(
      false,
    );
    expect(dailyStartSchema.safeParse({}).success).toBe(true);
  });
});

describe('server-authoritative local study dates', () => {
  it.each([
    ['2026-10-07T21:30:00Z', 'Europe/Bucharest', '2026-10-08'],
    ['2026-10-07T21:30:00Z', 'UTC', '2026-10-07'],
    ['2026-03-28T21:59:59Z', 'Europe/Bucharest', '2026-03-28'],
    ['2026-03-28T22:00:00Z', 'Europe/Bucharest', '2026-03-29'],
    ['2026-03-29T00:59:59Z', 'Europe/Bucharest', '2026-03-29'],
    ['2026-03-29T01:00:00Z', 'Europe/Bucharest', '2026-03-29'],
    ['2026-10-25T00:59:59Z', 'Europe/Bucharest', '2026-10-25'],
    ['2026-10-25T01:00:00Z', 'Europe/Bucharest', '2026-10-25'],
    ['2026-01-01T00:00:00Z', 'America/Los_Angeles', '2025-12-31'],
  ])('%s in %s is %s', (timestamp, zone, date) =>
    expect(studyDate(new Date(timestamp), zone)).toBe(date),
  );
  it('rejects invalid zones', () =>
    expect(() => studyDate(new Date(), 'invalid')).toThrow());
});
