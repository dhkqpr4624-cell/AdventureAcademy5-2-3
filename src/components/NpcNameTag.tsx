type NpcNameTagProps = {
  displayName: string;
  displayRole: string;
  /** "shop": two plain lines (role without brackets on top, name below), larger type. */
  variant?: "npc" | "shop";
};

export function NpcNameTag({
  displayName,
  displayRole,
  variant = "npc",
}: NpcNameTagProps) {
  return (
    <span className={`base-camp-npc-name-tag ${variant === "shop" ? "is-shop" : ""}`} aria-hidden="true">
      {displayRole && <small>{variant === "shop" ? displayRole : <>&lt;{displayRole}&gt;</>}</small>}
      <strong>{displayName}</strong>
    </span>
  );
}
