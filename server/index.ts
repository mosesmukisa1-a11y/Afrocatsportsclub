import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "path";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use("/contracts", express.static(path.join(process.cwd(), "public", "contracts")));
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "mosesmukisa1@gmail.com";
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass) {
    try {
      const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail));
      const passwordHash = await bcrypt.hash(adminPass, 10);
      if (existing) {
        await db.update(schema.users).set({ passwordHash, role: "ADMIN", accountStatus: "ACTIVE", emailVerified: true, mustChangePassword: false, isSuperAdmin: true, roles: ["ADMIN"] }).where(eq(schema.users.id, existing.id));
      } else {
        await db.insert(schema.users).values({ fullName: "System Admin", email: adminEmail, passwordHash, role: "ADMIN", accountStatus: "ACTIVE", emailVerified: true, mustChangePassword: false, isSuperAdmin: true, roles: ["ADMIN"] });
      }
      log(`Admin provisioned: ${adminEmail}`);
    } catch (e: any) {
      log(`Admin provision warning: ${e.message}`);
    }
  }

  try {
    const allMatches = await db.select().from(schema.matches);
    const now = new Date();
    let fixed = 0;
    for (const match of allMatches) {
      const updates: Record<string, any> = {};
      const st = match.startTime ? new Date(match.startTime) : null;

      if (st && st > now) {
        if (match.status !== "UPCOMING" || match.homeScore !== null || match.awayScore !== null) {
          updates.status = "UPCOMING";
          updates.homeScore = null;
          updates.awayScore = null;
          updates.scoreSource = "NONE";
          updates.scoreLocked = false;
          updates.statsEntered = false;
        }
      } else if (match.statsEntered || match.scoreLocked || (match.scoreSource && match.scoreSource !== "NONE")) {
        if (match.status !== "PLAYED") {
          updates.status = "PLAYED";
        }
      } else if (match.status === "SCHEDULED") {
        updates.status = st && st <= now ? "PLAYED" : "UPCOMING";
      }

      if (Object.keys(updates).length > 0) {
        await db.update(schema.matches).set(updates).where(eq(schema.matches.id, match.id));
        fixed++;
      }
    }
    if (fixed > 0) log(`Match status normalizer: fixed ${fixed} match(es)`);
  } catch (e: any) {
    log(`Match normalizer warning: ${e.message}`);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
