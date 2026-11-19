/** Initials of the first and last name parts, e.g. "Dudala Amulya" -> "DA". */
export function monogramFor(fullName: string): string {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
