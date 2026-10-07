import type { MistakeHistory } from '@/server/mistakes/repository';
import { ExerciseFeedback } from '@/components/exercises/feedback';
import { Card } from '@/components/ui/card';

function answerText(row: MistakeHistory) {
  const answer = row.submitted_answer;
  if ('text' in answer) return answer.text;
  // Current labels are safe only while the historical content version still matches.
  const label = (group: string, id: string) => {
    if (row.content_version !== row.current_version)
      return id.replaceAll('-', ' ');
    const items = row.payload[group] as
      { id: string; text: string }[] | undefined;
    return (
      items?.find((item) => item.id === id)?.text ?? id.replaceAll('-', ' ')
    );
  };
  if (answer.type === 'multiple_choice')
    return label('options', answer.optionId);
  if (answer.type === 'sentence_reorder')
    return answer.tokenIds.map((id) => label('tokens', id)).join(' ');
  return answer.pairs
    .map((p) => `${label('left', p.leftId)} → ${label('right', p.rightId)}`)
    .join('; ');
}
export function MistakeHistoryCards({
  rows,
  timezone,
}: {
  rows: MistakeHistory[];
  timezone: string;
}) {
  return (
    <div className="mistake-history">
      {rows.map((row) => (
        <Card key={row.id}>
          <h3>{row.label}</h3>
          <p>
            {row.lesson_title} · {row.source} ·{' '}
            <time dateTime={new Date(row.created_at).toISOString()}>
              {new Date(row.created_at).toLocaleString('en-GB', {
                timeZone: timezone,
              })}
            </time>
          </p>
          {row.content_version === row.current_version && <p>{row.prompt}</p>}
          <p>
            <strong>Your answer:</strong> {answerText(row)}
          </p>
          {row.content_version !== row.current_version && (
            <p>
              Earlier content version; saved response identifiers and feedback
              are preserved.
            </p>
          )}
          <ExerciseFeedback result={{ ...row.result, attemptId: row.id }} />
        </Card>
      ))}
    </div>
  );
}
