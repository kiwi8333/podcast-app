function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportOpml(favorites) {
  const outlines = favorites
    .map(
      (f) =>
        `    <outline type="rss" text="${escapeXml(f.title || f.feedUrl)}" xmlUrl="${escapeXml(f.feedUrl)}" />`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Podcast Subscriptions</title>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

// An OPML file is something the user was handed, so its contents are
// untrusted input rather than their own settings. Anything that isn't an
// http(s) feed URL cannot be fetched by /api/feed anyway — keeping those
// entries only writes junk (javascript: and data: URLs among it) into the
// favorites list the whole app reads back.
const MAX_IMPORT_ENTRIES = 500;

function isImportableFeedUrl(value) {
  if (typeof value !== "string" || !value || value.length > 2000) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function parseOpml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");
  const outlines = Array.from(doc.querySelectorAll("outline[xmlUrl]"));
  return outlines
    .map((el) => ({
      feedUrl: el.getAttribute("xmlUrl"),
      title: (el.getAttribute("text") || el.getAttribute("title") || "").slice(0, 300),
    }))
    .filter((entry) => isImportableFeedUrl(entry.feedUrl))
    .slice(0, MAX_IMPORT_ENTRIES);
}
