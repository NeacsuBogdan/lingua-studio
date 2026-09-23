'use client';
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { InferSelectModel } from 'drizzle-orm';
import type { learnerProfiles } from '@/server/db/schema';
import {
  saveProfile,
  type SaveProfileState,
} from '@/app/(app)/settings/actions';

const languages = [
  ['ro', 'Romanian'],
  ['en', 'English'],
  ['ja', 'Japanese'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
] as const;
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const durations = [5, 10, 20, 30, 45, 60] as const;
const initialState: SaveProfileState = { status: 'idle', message: '' };
type Profile = InferSelectModel<typeof learnerProfiles>;

function formValues(profile: Profile) {
  return {
    nativeLanguage: profile.nativeLanguage,
    learningLanguage: profile.learningLanguage,
    targetLevel: profile.targetLevel,
    targetExam: profile.targetExam ?? '',
    dailyMinutes: String(profile.dailyMinutes),
    timezone: profile.timezone,
  };
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(() => formValues(profile));
  function change(field: keyof ReturnType<typeof formValues>, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState(initialState);
    startTransition(async () => {
      try {
        const result = await saveProfile(data);
        setState(result);
        if (result.status === 'saved') router.refresh();
        if (result.status === 'unauthorized') router.replace('/sign-in');
      } catch {
        setState({
          status: 'invalid',
          message: 'Unable to save. Please try again.',
        });
      }
    });
  }
  return (
    <form onSubmit={submit} className="profile-form">
      <div className="profile-fields">
        <label>
          Native language
          <select
            name="nativeLanguage"
            value={values.nativeLanguage}
            onChange={(event) => change('nativeLanguage', event.target.value)}
            required
          >
            {languages.map(([code, name]) => (
              <option value={code} key={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Learning language
          <select
            name="learningLanguage"
            value={values.learningLanguage}
            onChange={(event) => change('learningLanguage', event.target.value)}
            required
          >
            {languages.map(([code, name]) => (
              <option value={code} key={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target CEFR level
          <select
            name="targetLevel"
            value={values.targetLevel}
            onChange={(event) => change('targetLevel', event.target.value)}
            required
          >
            {levels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label>
          Cambridge target
          <select
            name="targetExam"
            value={values.targetExam}
            onChange={(event) => change('targetExam', event.target.value)}
          >
            <option value="">No exam target yet</option>
            <option value="b2-first">B2 First</option>
            <option value="c1-advanced">C1 Advanced</option>
            <option value="c2-proficiency">C2 Proficiency</option>
          </select>
        </label>
        <label>
          Daily study target
          <select
            name="dailyMinutes"
            value={values.dailyMinutes}
            onChange={(event) => change('dailyMinutes', event.target.value)}
            required
          >
            {durations.map((minutes) => (
              <option value={minutes} key={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
        <label>
          Time zone
          <input
            name="timezone"
            value={values.timezone}
            onChange={(event) => change('timezone', event.target.value)}
            required
            maxLength={80}
            autoComplete="off"
            list="timezones"
          />
          <datalist id="timezones">
            <option value="Europe/Bucharest" />
            <option value="Europe/London" />
            <option value="Europe/Madrid" />
            <option value="Europe/Rome" />
            <option value="Asia/Tokyo" />
            <option value="UTC" />
          </datalist>
        </label>
      </div>
      <button className="save-button" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
      {state.message && (
        <p
          role="status"
          className={
            state.status === 'invalid' || state.status === 'unauthorized'
              ? 'form-error'
              : 'form-success'
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
