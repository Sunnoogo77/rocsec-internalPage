import { Button } from "./Button";
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
      <div role="alert" className="queryFeedback">
        <div>
          <strong>Le chargement a échoué.</strong>
          <p>Les informations ne sont pas disponibles pour le moment.</p>
        </div>
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
