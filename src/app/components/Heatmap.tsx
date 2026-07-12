import type { JourActivite } from "@/lib/queries";

// Calendrier type GitHub : 53 semaines × 7 jours, intensité = épisodes/jour.
export function Heatmap({ data }: { data: JourActivite[] }) {
  const map = new Map(data.map((d) => [d.jour, d.nb]));
  const max = Math.max(1, ...data.map((d) => d.nb));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 363);
  const lundiOffset = (start.getDay() + 6) % 7; // 0 = lundi
  start.setDate(start.getDate() - lundiOffset);

  const semaines: { iso: string; nb: number; futur: boolean }[][] = [];
  const cur = new Date(start);
  while (cur <= today) {
    const semaine: { iso: string; nb: number; futur: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const key = iso(cur);
      semaine.push({ iso: key, nb: map.get(key) ?? 0, futur: cur > today });
      cur.setDate(cur.getDate() + 1);
    }
    semaines.push(semaine);
  }
  const niveau = (nb: number) => (nb <= 0 ? 0 : Math.min(4, Math.ceil((nb / max) * 4)));

  return (
    <div className="heatmap-wrap">
      <div className="heatmap">
        {semaines.map((sem, i) => (
          <div key={i} className="hm-col">
            {sem.map((j) => (
              <span
                key={j.iso}
                className={`hm-cell hm-${j.futur ? "x" : niveau(j.nb)}`}
                title={j.futur ? "" : `${j.iso} · ${j.nb} épisode${j.nb > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="hm-legende muted">
        Moins
        <span className="hm-cell hm-0" />
        <span className="hm-cell hm-1" />
        <span className="hm-cell hm-2" />
        <span className="hm-cell hm-3" />
        <span className="hm-cell hm-4" />
        Plus
      </div>
    </div>
  );
}
