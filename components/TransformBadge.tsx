import { isTransformed } from "@/lib/transform";

// Shown only when the text starts with the transform's header line. Never used for interview answers.
export function TransformBadge({ text }: { text: string }) {
  if (!isTransformed(text)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs" role="status">
      <span aria-hidden>&#10003;</span>
      Sorted by the Pivotin&apos; transform
    </span>
  );
}
