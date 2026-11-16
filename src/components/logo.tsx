/** A tank built from three blocks in the colours of the flag: green turret, white hull, red track. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="56 142 420 264" className={className} aria-hidden="true">
      <polygon points="176.0,150.0 336.0,150.0 336.0,220.0 176.0,220.0" fill="#009246" />
      <polygon points="336.0,172.0 468.0,172.0 468.0,198.0 336.0,198.0" fill="#009246" />
      <polygon points="96.0,232.0 416.0,232.0 416.0,302.0 96.0,302.0" fill="#ffffff" />
      <polygon points="64.0,314.0 448.0,314.0 448.0,398.0 64.0,398.0" fill="#ce2b37" />
      <polygon points="92.0,338.0 128.0,338.0 128.0,374.0 92.0,374.0" fill="#000000" />
      <polygon points="162.0,338.0 198.0,338.0 198.0,374.0 162.0,374.0" fill="#000000" />
      <polygon points="238.0,338.0 274.0,338.0 274.0,374.0 238.0,374.0" fill="#000000" />
      <polygon points="314.0,338.0 350.0,338.0 350.0,374.0 314.0,374.0" fill="#000000" />
      <polygon points="384.0,338.0 420.0,338.0 420.0,374.0 384.0,374.0" fill="#000000" />
    </svg>
  );
}
