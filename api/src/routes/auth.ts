import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Database } from '../services/database';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/auth/register - 用户注册
 */
router.post('/register', async (req, res: Response): Promise<any> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: '用户名、邮箱和密码不能为空' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, error: '用户名长度须在 3-20 个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '密码长度不能少于 6 位' });
    }

    const db = Database.getInstance();

    const existingByUsername = await db.getUserByUsername(username);
    if (existingByUsername) {
      return res.status(409).json({ success: false, error: '用户名已被使用' });
    }

    const existingByEmail = await db.getUserByEmail(email);
    if (existingByEmail) {
      return res.status(409).json({ success: false, error: '邮箱已被注册' });
    }

    const user = await db.createUser({ username, email, password });

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    return res.status(500).json({ success: false, error: '注册失败，请稍后重试' });
  }
});

/**
 * POST /api/v1/auth/login - 用户登录
 */
router.post('/login', async (req, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }

    const db = Database.getInstance();
    const user = await db.getUserByUsername(username);

    if (!user) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    const token = generateToken({ id: user.id, role: user.role });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

/**
 * GET /api/v1/auth/profile - 获取当前用户信息（需认证）
 */
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const db = Database.getInstance();
    const user = await db.getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        created_at: user.created_at
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/v1/auth/profile - 更新用户信息（需认证）
 */
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { username, email, avatar } = req.body;
    const db = Database.getInstance();

    if (username) {
      const existing = await db.getUserByUsername(username);
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ success: false, error: '用户名已被使用' });
      }
    }

    if (email) {
      const existing = await db.getUserByEmail(email);
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ success: false, error: '邮箱已被注册' });
      }
    }

    await db.updateUser(req.user!.id, { username, email, avatar });
    const updated = await db.getUserById(req.user!.id);

    return res.json({
      success: true,
      data: {
        id: updated!.id,
        username: updated!.username,
        email: updated!.email,
        role: updated!.role,
        avatar: updated!.avatar
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: '更新用户信息失败' });
  }
});

/**
 * PUT /api/v1/auth/password - 修改密码（需认证）
 */
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '旧密码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码长度不能少于 6 位' });
    }

    const db = Database.getInstance();
    const user = await db.getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const passwordMatch = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: '旧密码不正确' });
    }

    await db.updateUserPassword(req.user!.id, newPassword);

    return res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (error) {
    logger.error('Change password error:', error);
    return res.status(500).json({ success: false, error: '修改密码失败' });
  }
});

export { router as authRoutes };
