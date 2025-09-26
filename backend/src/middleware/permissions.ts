import { Request, Response, NextFunction } from 'express';
import { runSingle } from '../config/database';

interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role?: string;
  };
}

export const checkPermission = (permissionName: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      // Get user's role
      const user = await runSingle<{ role: string }>(
        'SELECT role FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      // Admin has all permissions
      if (user.role === 'admin') {
        req.user.role = user.role;
        next();
        return;
      }

      // Check if user's role has the required permission
      const permission = await runSingle(
        `SELECT p.id FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role = ? AND p.name = ?`,
        [user.role || 'user', permissionName]
      );

      if (!permission) {
        res.status(403).json({ message: 'Insufficient permissions' });
        return;
      }

      req.user.role = user.role;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};

export const checkFilePermission = (permissionType: 'view' | 'edit' | 'delete' | 'share') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const fileId = req.params.id || req.params.fileId;
      if (!fileId) {
        res.status(400).json({ message: 'File ID is required' });
        return;
      }

      // Check if user owns the file
      const file = await runSingle<{ user_id: number }>(
        'SELECT user_id FROM files WHERE id = ?',
        [fileId]
      );

      if (!file) {
        res.status(404).json({ message: 'File not found' });
        return;
      }

      // Owner has all permissions
      if (file.user_id === req.user.userId) {
        next();
        return;
      }

      // Get user's role
      const user = await runSingle<{ role: string }>(
        'SELECT role FROM users WHERE id = ?',
        [req.user.userId]
      );

      // Admin has all permissions
      if (user?.role === 'admin') {
        req.user.role = user.role;
        next();
        return;
      }

      // Check specific file permission
      const filePermission = await runSingle(
        'SELECT id FROM file_permissions WHERE file_id = ? AND user_id = ? AND permission = ?',
        [fileId, req.user.userId, permissionType]
      );

      if (!filePermission) {
        // Check if file is public (for view permission only)
        if (permissionType === 'view') {
          const publicFile = await runSingle(
            'SELECT is_public FROM files WHERE id = ? AND is_public = 1',
            [fileId]
          );
          if (publicFile) {
            next();
            return;
          }
        }
        res.status(403).json({ message: 'Insufficient permissions for this file' });
        return;
      }

      next();
    } catch (error) {
      console.error('File permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await runSingle<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user || user.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }

    req.user.role = user.role;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};