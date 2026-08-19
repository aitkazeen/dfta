interface RssItem {
  link: string | null;
  title: string | null;
  description: string | null;
}

export function parseRss(xml: string): RssItem[] {
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const linkRe = /<link>([\s\S]*?)<\/link>/;
  const titleRe = /<title>(?:<b>)?([\s\S]*?)(?:<\/b>)?<\/title>/;
  const descRe = /<description>([\s\S]*?)<\/description>/;

  const items: RssItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];

    const link = block.match(linkRe);
    const title = block.match(titleRe);
    const desc = block.match(descRe);

    items.push({
      link: link ? link[1].trim() : null,
      title: title ? title[1].trim() : null,
      description: desc ? desc[1].trim() : null,
    });
  }

  return items;
}
