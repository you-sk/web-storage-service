import express, { Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { isAdmin, checkPermission } from '../middleware/permissions';
import { runQuery, runInsert, runDelete, runSingle } from '../config/database';

const router = express.Router();

interface AuthRequest extends express.Request {
  user?: {
    userId: number;
    username: string;
    role?: string;
  };
}

// Get all permissions
router.get('/permissions', authenticateToken, isAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const permissions = await runQuery(
      'SELECT * FROM permissions ORDER BY name'
    );
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions' });
  }
});

// Get permissions for a role
router.get('/roles/:role/permissions', authenticateToken, isAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    const permissions = await runQuery(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = ?
       ORDER BY p.name`,
      [role]
    );
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ message: 'Failed to fetch role permissions' });
  }
});

// Assign permission to role
router.post('/roles/:role/permissions', authenticateToken, checkPermission('manage_roles'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    const { permissionId } = req.body;

    if (!permissionId) {
      res.status(400).json({ message: 'Permission ID is required' });
      return;
    }

    await runInsert(
      'INSERT OR IGNORE INTO role_permissions (role, permission_id) VALUES (?, ?)',
      [role, permissionId]
    );

    res.json({ message: 'Permission assigned successfully' });
  } catch (error) {
    console.error('Error assigning permission:', error);
    res.status(500).json({ message: 'Failed to assign permission' });
  }
});

// Remove permission from role
router.delete('/roles/:role/permissions/:permissionId', authenticateToken, checkPermission('manage_roles'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, permissionId } = req.params;

    await runDelete(
      'DELETE FROM role_permissions WHERE role = ? AND permission_id = ?',
      [role, permissionId]
    );

    res.json({ message: 'Permission removed successfully' });
  } catch (error) {
    console.error('Error removing permission:', error);
    res.status(500).json({ message: 'Failed to remove permission' });
  }
});

// Grant file permission to user
router.post('/files/:fileId/permissions', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { fileId } = req.params;
    const { userId, permission } = req.body;

    if (!userId || !permission) {
      res.status(400).json({ message: 'User ID and permission are required' });
      return;
    }

    if (!['view', 'edit', 'delete', 'share'].includes(permission)) {
      res.status(400).json({ message: 'Invalid permission type' });
      return;
    }

    // Check if user owns the file or is admin
    const file = await runSingle<{ user_id: number }>(
      'SELECT user_id FROM files WHERE id = ?',
      [fileId]
    );

    if (!file) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    const user = await runSingle<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (file.user_id !== req.user.userId && user?.role !== 'admin') {
      // Check if user has share permission
      const sharePermission = await runSingle(
        'SELECT id FROM file_permissions WHERE file_id = ? AND user_id = ? AND permission = ?',
        [fileId, req.user.userId, 'share']
      );

      if (!sharePermission) {
        res.status(403).json({ message: 'You do not have permission to share this file' });
        return;
      }
    }

    await runInsert(
      'INSERT OR REPLACE INTO file_permissions (file_id, user_id, permission, granted_by) VALUES (?, ?, ?, ?)',
      [fileId, userId, permission, req.user.userId]
    );

    res.json({ message: 'File permission granted successfully' });
  } catch (error) {
    console.error('Error granting file permission:', error);
    res.status(500).json({ message: 'Failed to grant file permission' });
  }
});

// Revoke file permission from user
router.delete('/files/:fileId/permissions/:userId/:permission', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { fileId, userId, permission } = req.params;

    // Check if user owns the file or is admin
    const file = await runSingle<{ user_id: number }>(
      'SELECT user_id FROM files WHERE id = ?',
      [fileId]
    );

    if (!file) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    const user = await runSingle<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (file.user_id !== req.user.userId && user?.role !== 'admin') {
      res.status(403).json({ message: 'You do not have permission to revoke permissions for this file' });
      return;
    }

    await runDelete(
      'DELETE FROM file_permissions WHERE file_id = ? AND user_id = ? AND permission = ?',
      [fileId, userId, permission]
    );

    res.json({ message: 'File permission revoked successfully' });
  } catch (error) {
    console.error('Error revoking file permission:', error);
    res.status(500).json({ message: 'Failed to revoke file permission' });
  }
});

// Get file permissions
router.get('/files/:fileId/permissions', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { fileId } = req.params;

    // Check if user owns the file or is admin
    const file = await runSingle<{ user_id: number }>(
      'SELECT user_id FROM files WHERE id = ?',
      [fileId]
    );

    if (!file) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    const user = await runSingle<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (file.user_id !== req.user.userId && user?.role !== 'admin') {
      res.status(403).json({ message: 'You do not have permission to view permissions for this file' });
      return;
    }

    const permissions = await runQuery(
      `SELECT fp.*, u.username, u.email, gb.username as granted_by_username
       FROM file_permissions fp
       JOIN users u ON fp.user_id = u.id
       JOIN users gb ON fp.granted_by = gb.id
       WHERE fp.file_id = ?
       ORDER BY fp.created_at DESC`,
      [fileId]
    );

    res.json(permissions);
  } catch (error) {
    console.error('Error fetching file permissions:', error);
    res.status(500).json({ message: 'Failed to fetch file permissions' });
  }
});

// Update user role
router.put('/users/:userId/role', authenticateToken, checkPermission('manage_roles'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'user', 'guest'].includes(role)) {
      res.status(400).json({ message: 'Valid role is required (admin, user, or guest)' });
      return;
    }

    await runDelete(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Get all users with roles (admin only)
router.get('/admin/users', authenticateToken, checkPermission('manage_users'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await runQuery(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

export default router;