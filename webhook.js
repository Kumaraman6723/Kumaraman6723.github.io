const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 3002;

let clients = [];

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Serve static files from the public folder

app.post("/webhook", (req, res) => {
  const data = req.body;
  console.log("Webhook received:", data);

  // Send data to all connected clients
  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(data)}\n\n`)
  );

  res.status(200).send("Webhook received");
});

app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Send headers

  clients.push({ req, res });

  req.on("close", () => {
    clients = clients.filter((client) => client.req !== req);
  });
});

app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
});
