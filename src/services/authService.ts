import bcrypt from 'bcrypt';
import { DBWrapper } from '../db.js';
import { generateToken, AuthUser } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  private db: DBWrapper;

  constructor(db: DBWrapper) {
    this.db = db;
  }

  async register(name: string, email: string, password: string, phone: string): Promise<{ token: string; user: AuthUser }> {
    // Check if user already exists
    const existing = await this.db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      throw new Error('El email ya está registrado');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const userId = `user_${Date.now()}`;
    await this.db.run(
      'INSERT INTO users (id, name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, email, password_hash, phone, 'admin']
    );

    // Create tenant automatically for this user
    const tenantId = `tenant_${Date.now()}`;
    const tenantName = name;
    await this.db.run(
      `INSERT INTO tenants (id, name, status, plan, mrr, bg_color, init_letters) 
       VALUES (?, ?, 'Active', 'Free', 0, 'bg-green-100 text-green-600', ?)`,
      [tenantId, tenantName, name.substring(0, 2).toUpperCase()]
    );

    // Link user to tenant
    await this.db.run(
      'INSERT INTO user_tenants (user_id, tenant_id, role) VALUES (?, ?, ?)',
      [userId, tenantId, 'owner']
    );

    const user: AuthUser = { id: userId, email, role: 'ADMINISTRATOR', tenant_id: tenantId };
    const token = generateToken(user);

    return { token, user };
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.db.get<any>(
      'SELECT u.id, u.email, u.password_hash, u.role, ut.tenant_id FROM users u LEFT JOIN user_tenants ut ON u.id = ut.user_id WHERE u.email = ? LIMIT 1',
      [email]
    );

    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Credenciales inválidas');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role === 'admin' ? 'ADMINISTRATOR' : user.role === 'super_admin' ? 'SUPER_ADMIN' : user.role,
      tenant_id: user.tenant_id || undefined
    };

    const token = generateToken(authUser);
    return { token, user: authUser };
  }
}
