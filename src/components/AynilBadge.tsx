/**
 * Small credit badge fixed at the bottom-right of every page. Text-based
 * for now -- swap in an <img src="/aynil-logo.png" /> once the actual
 * wordmark image is added to /public.
 */
export default function AynilBadge() {
  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-medium tracking-wide text-white/60 backdrop-blur-sm">
      <span className="text-white/40">By</span>
      <span className="font-semibold tracking-[0.15em] text-white/80">AYNIL</span>
    </div>
  );
}
