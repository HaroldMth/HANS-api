// /api/[...slug].js
export default async function handler(req, res) {
  try {
    const backendBase = "https://api-api-hans.onrender.com";
    const slugPath = req.query.slug.join("/"); // captures everything after /api/
    
    // Forward query string
    const queryString = new URLSearchParams(req.query);
    queryString.delete("slug"); // remove the slug param from query
    const url = `${backendBase}/${slugPath}?${queryString.toString()}`;

    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: ["POST", "PUT", "PATCH"].includes(req.method) ? JSON.stringify(req.body) : undefined
    });

    if (response.status === 404) {
      // Redirect to /Notfound page
      res.writeHead(302, { Location: '/Notfound' });
      res.end();
      return;
    }

    // Forward JSON or text
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
