import { useCallback, useEffect, useState } from 'react';

export function useUnsavedChanges(isDirty: boolean) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const guardAction = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      setPendingAction(() => action);
    },
    [isDirty]
  );

  const confirmLeave = useCallback(() => {
    const fn = pendingAction;
    setPendingAction(null);
    fn?.();
  }, [pendingAction]);

  const cancelLeave = useCallback(() => {
    setPendingAction(null);
  }, []);

  return {
    showConfirmDialog: Boolean(pendingAction),
    guardAction,
    confirmLeave,
    cancelLeave,
  };
}
