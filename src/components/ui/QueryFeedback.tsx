import { Button } from "./Button";
import { ActionError } from "./ActionError";
export function QueryFeedback({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  if (error)
    return (
      <div className="queryFeedback">
        <ActionError error={error} title="Le chargement a échoué." />
        {retry && <Button onClick={retry}>Réessayer</Button>}
      </div>
    );
  if (loading)
    return (
      <div role="status" className="queryFeedback">
        Chargement des informations…
      </div>
    );
  return null;
}
