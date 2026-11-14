//Mentions are markdown links with an id as target, [Mara](char:mara-2),
//so text written by and for LLMs refers to things without ambiguity.

/**A piece of text, a mention when id is set*/
export interface MentionPart {
  text: string;
  id?: string;
}

const MENTION = /\[([^\]\n]+)\]\(([a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*)\)/g;

/**Splits text into plain parts and mentions*/
export function mention_parse(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[1], id: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/**Ids of all mentions in the text*/
export function mention_ids(text: string): string[] {
  return [...text.matchAll(MENTION)].map((m) => m[2]);
}

/**Rewrites every mention, the function gets the shown text and id and returns the new mention,
 * or a string to replace the whole mention with plain text*/
export function mention_map(
  text: string,
  map: (text: string, id: string) => { text: string; id: string } | string,
): string {
  return text.replace(MENTION, (_m, shown: string, id: string) => {
    const mapped = map(shown, id);
    return typeof mapped === "string"
      ? mapped
      : `[${mapped.text}](${mapped.id})`;
  });
}

/**Text with every mention replaced by its shown text*/
export function mention_plain(text: string): string {
  return mention_map(text, (shown) => shown);
}
