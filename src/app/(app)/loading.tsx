/**
 * Squelette affiché instantanément à chaque navigation : l'écran répond au
 * doigt pendant que le serveur prépare la vraie page. C'est ce qui supprime
 * l'impression de latence au clic.
 */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-3 pt-1" aria-label="Chargement">
      <div className="h-20 rounded-card bg-accent/15" />
      <div className="h-16 rounded-card bg-surface" />
      <div className="mt-3 h-5 w-40 rounded-full bg-surface" />
      <div className="h-14 rounded-card bg-surface" />
      <div className="h-14 rounded-card bg-surface" />
      <div className="h-14 rounded-card bg-surface" />
    </div>
  );
}
