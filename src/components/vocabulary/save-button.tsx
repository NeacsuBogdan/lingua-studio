import { setSavedAction } from '@/app/(app)/vocabulary/actions';
export function SaveButton({ id, saved }: { id: string; saved: boolean }) {
  return (
    <form action={setSavedAction.bind(null, id, !saved)}>
      <button
        className="vocab-save"
        type="submit"
        aria-label={`${saved ? 'Remove' : 'Save'} vocabulary item`}
      >
        {saved ? 'Remove from saved' : 'Save word'}
      </button>
    </form>
  );
}
