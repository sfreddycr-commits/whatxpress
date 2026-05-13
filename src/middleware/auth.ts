import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set.');
  }
  return secret;
}
export const JWT_SECRET = process.env.JWT_SECRET || '';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return;
  }
};

export const verifyTenantAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  // Super admins can access everything
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin') {
    next();
    return;
  }

  const targetTenantId = req.params.tenantId || req.body.tenant_id;

  // If no tenantId is explicitly passed, we let it proceed to the route handler 
  // (which might be doing internal tenant isolation based on req.user.tenant_id)
  if (!targetTenantId) {
    next();
    return;
  }

  if (req.user.tenant_id !== targetTenantId) {
    res.status(403).json({ error: 'Acceso denegado: No tienes permiso para acceder a este tenant' });
    return;
  }

  next();
};

export const generateToken = (user: { id: string; email: string; role: string; tenant_id?: string }): string => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "No token provided" });
      return;
    }
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
  }
  
  const userRole = req.user.role ? req.user.role.toUpperCase() : "";
  if (userRole !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};
