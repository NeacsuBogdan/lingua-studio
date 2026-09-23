'use client';
import { useActionState } from 'react';
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

export function ProfileForm({
  profile,
}: {
  profile: InferSelectModel<typeof learnerProfiles>;
}) {
  const [state, action, pending] = useActionState(saveProfile, initialState);
  return (
    <form action={action} className="profile-form">
      <div className="profile-fields">
        <label>
          Native language
          <select
            name="nativeLanguage"
            defaultValue={profile.nativeLanguage}
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
            defaultValue={profile.learningLanguage}
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
            defaultValue={profile.targetLevel}
            required
          >
            {levels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label>
          Cambridge target
          <select name="targetExam" defaultValue={profile.targetExam ?? ''}>
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
            defaultValue={profile.dailyMinutes}
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
            defaultValue={profile.timezone}
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
          className={state.status === 'invalid' ? 'form-error' : 'form-success'}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
