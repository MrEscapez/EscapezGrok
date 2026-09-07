import { useLiveFeed } from '../hooks/useLiveFeed';

function formatTs(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nl-BE', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'Europe/Brussels',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(
  status: ReturnType<typeof useLiveFeed>['status'],
): { text: string; className: string } {
  switch (status) {
    case 'open':
      return { text: 'Live', className: 'status-pill status-pill--online' };
    case 'connecting':
      return { text: 'Verbinden…', className: 'status-pill status-pill--loading' };
    case 'error':
      return { text: 'Herverbinden', className: 'status-pill status-pill--offline' };
    case 'unsupported':
      return { text: 'Niet ondersteund', className: 'status-pill status-pill--muted' };
    default:
      return { text: 'Idle', className: 'status-pill status-pill--muted' };
  }
}

type Props = { enabled?: boolean; maxVisible?: number };

export function LiveFeedWidget({ enabled = true, maxVisible = 8 }: Props) {
  const feed = useLiveFeed(enabled);
  const pill = statusLabel(feed.status);
  const visible = feed.events.slice(0, maxVisible);

  return (
    <article className="dash-card dash-card--wide">
      <div className="dash-card__head">
        <h2 className="dash-card__title">Live feed</h2>
        <span className={pill.className}>{pill.text}</span>
      </div>

      {feed.errorMessage ? (
        <p className="dash-card__hint dash-card__hint--warn">{feed.errorMessage}</p>
      ) : null}

      {feed.status === 'unsupported' ? (
        <p className="dash-card__hint">
          SSE niet beschikbaar — live feed is optioneel in deze browser.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="dash-card__hint">
          Nog geen events. EscapezCore heartbeats en bridge-events verschijnen hier.
        </p>
      ) : (
        <ul className="live-feed">
          {visible.map((ev) => (
            <li key={ev.id} className="live-feed__item">
              <span className="live-feed__label">{ev.label}</span>
              <time className="live-feed__time" dateTime={ev.at}>
                {formatTs(ev.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
