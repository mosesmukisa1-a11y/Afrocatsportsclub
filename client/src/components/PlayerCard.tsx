import { useRef, useState, useEffect } from "react";
import { toJpeg } from "html-to-image";
import { Download, Loader2 } from "lucide-react";

interface PlayerCardData {
  playerName: string;
  position: string;
  jerseyNo?: number | null;
  photoUrl?: string | null;
  teamName?: string;
  stats: {
    kills?: number;
    aces?: number;
    blocks?: number;
    digs?: number;
    assists?: number;
    points?: number;
    matches?: number;
  };
  stars: {
    atk: number;
    srv: number;
    def: number;
    blk: number;
  };
  badge?: string;
  badgeColor?: "gold" | "teal" | "purple";
}

/** Converts any image URL to a base64 data URL so html-to-image can capture it. */
async function toDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { cache: "force-cache" });
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function Stars({ count, max = 5, color = "#EFC42C" }: { count: number; max?: number; color?: string }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 12 12">
          <polygon
            points="6,0 7.5,4 12,4.5 8.5,7.5 9.5,12 6,9.5 2.5,12 3.5,7.5 0,4.5 4.5,4"
            fill={i < count ? color : "rgba(255,255,255,0.15)"}
          />
        </svg>
      ))}
    </div>
  );
}

interface PlayerCardProps {
  data: PlayerCardData;
  showDownload?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PlayerCard({ data, showDownload = true, size = "md" }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const W = size === "sm" ? 220 : size === "lg" ? 360 : 280;
  const H = Math.round(W * 1.4);
  const scale = W / 280;
  const s = (n: number) => Math.round(n * scale);

  const { photoUrl } = data;

  /* Pre-load player photo as base64 so html-to-image can embed it */
  useEffect(() => {
    setPhotoDataUrl(null);
    if (!photoUrl) return;
    let cancelled = false;
    toDataUrl(photoUrl).then(url => {
      if (!cancelled) setPhotoDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [photoUrl]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      /* Ensure photo is loaded before capture */
      let imgSrc = photoDataUrl;
      if (!imgSrc && photoUrl) {
        imgSrc = await toDataUrl(photoUrl);
        setPhotoDataUrl(imgSrc);
        await new Promise(r => setTimeout(r, 80)); // let React re-render
      }

      const dataUrl = await toJpeg(cardRef.current, {
        quality: 0.97,
        pixelRatio: 3,
        backgroundColor: "#0F1728",
        /* Skip external resources — we've already embedded them */
        fetchRequestInit: { cache: "force-cache" },
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${data.playerName.replace(/\s+/g, "_")}_card.jpg`;
      a.click();
    } catch (e) {
      console.error("Card download failed", e);
    } finally {
      setDownloading(false);
    }
  };

  const {
    stars,
    stats,
    playerName,
    position,
    jerseyNo,
    teamName = "AFROCAT VC",
    badge = "PLAYER",
    badgeColor = "gold",
  } = data;

  const badgeColors: Record<string, string> = {
    gold: "#EFC42C",
    teal: "#15A09B",
    purple: "#a855f7",
  };
  const badgeBg = badgeColors[badgeColor] || badgeColors.gold;

  const statRow = [
    { label: "ATK", val: stats.kills ?? 0, stars: stars.atk },
    { label: "SRV", val: stats.aces ?? 0, stars: stars.srv },
    { label: "DEF", val: stats.digs ?? 0, stars: stars.def },
    { label: "BLK", val: stats.blocks ?? 0, stars: stars.blk },
  ];

  /* The image source — use data URL if ready, else fall back to original URL */
  const imgSrc = photoDataUrl || photoUrl;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* ══ THE CARD ══ */}
      <div
        ref={cardRef}
        data-testid={`player-card-${playerName.replace(/\s+/g, "-").toLowerCase()}`}
        style={{
          width: W,
          height: H,
          borderRadius: s(18),
          overflow: "hidden",
          position: "relative",
          background: "#0F1728",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}
      >
        {/* ── Paint splash layers ── */}
        <div style={{
          position: "absolute", top: s(-30), left: s(-40), width: s(210), height: s(320),
          background: "linear-gradient(135deg, #15A09B 0%, #0d7377 100%)",
          transform: "rotate(-18deg)", opacity: 0.75, borderRadius: s(12),
        }} />
        <div style={{
          position: "absolute", top: s(-50), right: s(-30), width: s(180), height: s(280),
          background: "linear-gradient(135deg, #EFC42C 0%, #d4a017 100%)",
          transform: "rotate(14deg)", opacity: 0.6, borderRadius: s(12),
        }} />
        <div style={{
          position: "absolute", top: s(60), left: s(80), width: s(160), height: s(200),
          background: "linear-gradient(135deg, #1a4731 0%, #0f2e1f 100%)",
          transform: "rotate(-8deg)", opacity: 0.5, borderRadius: s(8),
        }} />
        <div style={{
          position: "absolute", bottom: s(100), right: s(-20), width: s(120), height: s(180),
          background: "linear-gradient(135deg, #15A09B 0%, transparent 100%)",
          transform: "rotate(25deg)", opacity: 0.3, borderRadius: s(8),
        }} />

        {/* ── Player photo (always use base64 src for capture) ── */}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={playerName}
            style={{
              position: "absolute",
              top: 0, left: 0, width: "100%", height: "65%",
              objectFit: "cover", objectPosition: "top center",
              display: "block",
            }}
          />
        ) : (
          /* Placeholder initials when no photo */
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "65%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: s(90), height: s(90), borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: s(32), fontWeight: 900, color: "rgba(255,255,255,0.5)",
            }}>
              {playerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          </div>
        )}

        {/* Photo-to-stats gradient overlay */}
        <div style={{
          position: "absolute", top: "28%", left: 0, right: 0, bottom: 0,
          background: "linear-gradient(to bottom, transparent 0%, rgba(15,23,40,0.82) 28%, rgba(15,23,40,0.97) 56%, #0F1728 100%)",
        }} />

        {/* ── Jersey badge (top-right) ── */}
        <div style={{
          position: "absolute", top: s(10), right: s(10),
          width: s(36), height: s(36), borderRadius: "50%",
          background: "rgba(15,23,40,0.85)",
          border: `${s(2)}px solid ${badgeBg}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: s(13), fontWeight: 900, color: badgeBg,
        }}>
          {jerseyNo ?? "—"}
        </div>

        {/* ── Award badge (top-left) ── */}
        <div style={{
          position: "absolute", top: s(10), left: s(10),
          padding: `${s(3)}px ${s(8)}px`,
          borderRadius: s(20),
          background: `${badgeBg}20`,
          border: `${s(1)}px solid ${badgeBg}55`,
        }}>
          <span style={{
            fontSize: s(8), fontWeight: 800, color: badgeBg,
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
          }}>
            {badge}
          </span>
        </div>

        {/* ── Bottom stats section ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: `${s(10)}px ${s(12)}px ${s(12)}px`,
        }}>
          {/* Star rating rows */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            marginBottom: s(8),
            padding: `${s(6)}px ${s(4)}px`,
            borderRadius: s(8),
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            {statRow.map(row => (
              <div key={row.label} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: s(2) }}>
                <Stars count={row.stars} color={badgeBg} />
                <span style={{ fontSize: s(8), fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
                  {row.label}
                </span>
              </div>
            ))}
          </div>

          {/* Player name */}
          <div style={{
            fontSize: s(17), fontWeight: 900, color: "#FFFFFF",
            letterSpacing: "0.04em", textTransform: "uppercase" as const,
            lineHeight: 1.1, marginBottom: s(2),
          }}>
            {playerName}
          </div>

          {/* Position + quick stats line */}
          <div style={{
            fontSize: s(9), fontWeight: 600, color: badgeBg,
            letterSpacing: "0.07em", marginBottom: s(7),
            textTransform: "uppercase" as const,
          }}>
            {position || "PLAYER"}
            {(stats.matches ?? 0) > 0 && (
              <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                {" "}· {stats.kills ?? 0}K {stats.aces ?? 0}A {stats.blocks ?? 0}BLK {stats.digs ?? 0}DIG
              </span>
            )}
          </div>

          {/* Club footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: s(6),
          }}>
            <div>
              <div style={{ fontSize: s(8), fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
                {teamName}
              </div>
              <div style={{ fontSize: s(7), color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                AFROCAT VOLLEYBALL CLUB
              </div>
            </div>
            <div style={{
              width: s(22), height: s(22), borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, rgba(239,196,44,0.25), rgba(21,160,155,0.2))",
              border: `${s(1)}px solid rgba(255,255,255,0.15)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: s(12),
            }}>🏐</div>
          </div>
        </div>

        {/* Corner accents */}
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: s(40), height: s(40),
          borderTop: `${s(3)}px solid ${badgeBg}`,
          borderLeft: `${s(3)}px solid ${badgeBg}`,
          borderRadius: `${s(18)}px 0 0 0`,
        }} />
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: s(30), height: s(30),
          borderBottom: `${s(2)}px solid rgba(255,255,255,0.12)`,
          borderRight: `${s(2)}px solid rgba(255,255,255,0.12)`,
          borderRadius: `0 0 ${s(18)}px 0`,
        }} />
      </div>

      {/* Download button */}
      {showDownload && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          data-testid={`btn-download-card-${playerName.replace(/\s+/g, "-").toLowerCase()}`}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8, cursor: downloading ? "wait" : "pointer",
            background: "rgba(21,160,155,0.15)", border: "1px solid rgba(21,160,155,0.4)",
            color: "#15A09B", fontSize: 12, fontWeight: 600,
          }}
        >
          {downloading
            ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
            : <><Download size={13} /> Download Card</>
          }
        </button>
      )}
    </div>
  );
}
