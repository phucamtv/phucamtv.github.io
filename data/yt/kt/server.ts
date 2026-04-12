const DATA_DIR = "./data";
await Bun.write(DATA_DIR + "/.keep", "");

Bun.serve({
  port: 3000,
  async fetch(req) {
    if (req.method === "POST") {
      const url = new URL(req.url);
      if (url.pathname === "/data") {
        const filename = url.searchParams.get("filename");
        if (!filename) {
          return new Response("Missing filename param", { status: 400 });
        }

        // Sanitize filename - no path traversal
        const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const body = await req.text();
        await Bun.write(`${DATA_DIR}/${safe}`, body);

        return new Response(`Saved ${safe}`, { status: 200 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Listening on http://localhost:3000");
