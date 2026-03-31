import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import webpush from "web-push";

const PORT = 3000;
const VAPID_FILE = path.join(process.cwd(), "vapid.json");
const SUBS_FILE = path.join(process.cwd(), "subscriptions.json");

// Initialize VAPID keys
let vapidKeys: { publicKey: string; privateKey: string };
if (fs.existsSync(VAPID_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
  "mailto:example@yourdomain.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Initialize subscriptions store
const getSubscriptions = (): Record<string, any> => {
  if (fs.existsSync(SUBS_FILE)) {
    return JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
  }
  return {};
};

const saveSubscription = (userId: string, subscription: any) => {
  const subs = getSubscriptions();
  subs[userId] = subscription;
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs));
};

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/push/subscribe", (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
      return res.status(400).json({ error: "Missing userId or subscription" });
    }
    saveSubscription(userId, subscription);
    res.json({ status: "success" });
  });

  app.post("/api/push/notify", async (req, res) => {
    const { targetUserId, title, body } = req.body;
    const subs = getSubscriptions();
    const subscription = subs[targetUserId];

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found for user" });
    }

    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
      res.json({ status: "success" });
    } catch (error) {
      console.error("Push error:", error);
      res.status(500).json({ error: "Failed to send push notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
