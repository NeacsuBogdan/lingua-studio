'use client';
import type { PublicExercise } from '@/content/activity-schema';
import type { ExerciseAnswer } from '@/lib/exercise-answer';

type Props = {
  activity: PublicExercise;
  answer: ExerciseAnswer | null;
  onChange: (answer: ExerciseAnswer) => void;
  disabled: boolean;
};

function Choice({
  activity,
  answer,
  onChange,
  disabled,
}: Props & { activity: Extract<PublicExercise, { type: 'multiple_choice' }> }) {
  return (
    <fieldset className="exercise-choices" disabled={disabled}>
      <legend>Your answer</legend>
      {activity.payload.options.map((option) => (
        <label
          key={option.id}
          className={
            answer?.type === 'multiple_choice' && answer.optionId === option.id
              ? 'choice-selected'
              : ''
          }
        >
          <input
            type="radio"
            name="option"
            value={option.id}
            required
            checked={
              answer?.type === 'multiple_choice' &&
              answer.optionId === option.id
            }
            onChange={() =>
              onChange({ type: 'multiple_choice', optionId: option.id })
            }
          />
          <span>{option.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function TextAnswer({
  activity,
  answer,
  onChange,
  disabled,
}: Props & {
  activity: Extract<
    PublicExercise,
    { type: 'fill_gap' | 'typed_answer' | 'translation' | 'error_correction' }
  >;
}) {
  const value = answer && 'text' in answer ? answer.text : '';
  const type = activity.type;
  return (
    <div className="exercise-text">
      {type === 'fill_gap' && (
        <p className="exercise-context">{activity.payload.context}</p>
      )}
      {type === 'translation' && (
        <p className="exercise-context">
          <span className="small-label">{activity.payload.sourceLanguage}</span>
          <br />
          {activity.payload.sourceText}
        </p>
      )}
      {type === 'error_correction' && (
        <p className="exercise-context">{activity.payload.originalText}</p>
      )}
      <label htmlFor={`answer-${activity.id}`}>Your answer</label>
      {type === 'translation' || type === 'error_correction' ? (
        <textarea
          id={`answer-${activity.id}`}
          value={value}
          onChange={(event) => onChange({ type, text: event.target.value })}
          rows={3}
          maxLength={2000}
          required
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <input
          id={`answer-${activity.id}`}
          value={value}
          onChange={(event) => onChange({ type, text: event.target.value })}
          maxLength={2000}
          required
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </div>
  );
}

function Reorder({
  activity,
  answer,
  onChange,
  disabled,
}: Props & {
  activity: Extract<PublicExercise, { type: 'sentence_reorder' }>;
}) {
  const selected = answer?.type === 'sentence_reorder' ? answer.tokenIds : [];
  const change = (tokenIds: string[]) =>
    onChange({ type: 'sentence_reorder', tokenIds });
  const move = (index: number, direction: number) => {
    const next = [...selected];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    change(next);
  };
  return (
    <fieldset className="exercise-reorder" disabled={disabled}>
      <legend>Your sentence</legend>
      <p className="form-hint">
        Add each token, then move or remove it using the buttons. All controls
        work with a keyboard.
      </p>
      <ol aria-label="Selected token order">
        {selected.map((id, index) => {
          const token = activity.payload.tokens.find((item) => item.id === id)!;
          return (
            <li key={id}>
              <span>{token.text}</span>
              <div className="token-controls">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`Move ${token.text} earlier`}
                  onClick={() => move(index, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={index === selected.length - 1}
                  aria-label={`Move ${token.text} later`}
                  onClick={() => move(index, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${token.text}`}
                  onClick={() => change(selected.filter((item) => item !== id))}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="token-bank" aria-label="Available tokens">
        {activity.payload.tokens
          .filter((token) => !selected.includes(token.id))
          .map((token) => (
            <button
              type="button"
              key={token.id}
              onClick={() => change([...selected, token.id])}
              aria-label={`Add ${token.text}`}
            >
              {token.text}
            </button>
          ))}
      </div>
    </fieldset>
  );
}

function Matching({
  activity,
  answer,
  onChange,
  disabled,
}: Props & { activity: Extract<PublicExercise, { type: 'matching' }> }) {
  const pairs = answer?.type === 'matching' ? answer.pairs : [];
  return (
    <fieldset className="exercise-matching" disabled={disabled}>
      <legend>Your matches</legend>
      {activity.payload.left.map((item) => (
        <div key={item.id}>
          <label htmlFor={`match-${item.id}`}>{item.text}</label>
          <select
            id={`match-${item.id}`}
            required
            value={pairs.find((pair) => pair.leftId === item.id)?.rightId ?? ''}
            onChange={(event) =>
              onChange({
                type: 'matching',
                pairs: [
                  ...pairs.filter((pair) => pair.leftId !== item.id),
                  { leftId: item.id, rightId: event.target.value },
                ],
              })
            }
          >
            <option value="">Choose an ending</option>
            {activity.payload.right.map((right) => (
              <option key={right.id} value={right.id}>
                {right.text}
              </option>
            ))}
          </select>
        </div>
      ))}
    </fieldset>
  );
}

export function AnswerControls(props: Props) {
  const { activity } = props;
  switch (activity.type) {
    case 'multiple_choice':
      return <Choice {...props} activity={activity} />;
    case 'sentence_reorder':
      return <Reorder {...props} activity={activity} />;
    case 'matching':
      return <Matching {...props} activity={activity} />;
    default:
      return <TextAnswer {...props} activity={activity} />;
  }
}
