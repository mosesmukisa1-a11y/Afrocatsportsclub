import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "afrocat-dev-secret-change-me";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  roles?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const tokenStr = header?.startsWith("Bearer ") ? header.split(" ")[1] : queryToken;
  if (!tokenStr) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(tokenStr, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
    if (!userRoles.some(r => roles.includes(r))) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}
