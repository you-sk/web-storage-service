import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { runQuery, runSingle } from '../config/database';

const router = express.Router();
// Get user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.userId;

    const user = await runSingle(`
      SELECT id, username, email, role, created_at, updated_at
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.userId;
      const { username, email } = req.body;

      if (!username && !email) {
        return res.status(400).json({ error: 'At least one field (username or email) must be provided' });
      }

    // Check if username is already taken by another user
    if (username) {
      const existingUser = await runSingle(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );

      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await runSingle(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }

    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    updates.push('updated_at = datetime("now")');
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

    await runQuery(updateQuery, values);

    // Fetch updated user
    const updatedUser = await runSingle(`
      SELECT id, username, email, created_at, updated_at
      FROM users
      WHERE id = ?
    `, [userId]);

    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

    // Get current user with password
    const user = await runSingle<{ id: number; password: string }>(
      'SELECT id, password FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await runQuery(`
      UPDATE users
      SET password = ?, updated_at = datetime("now")
      WHERE id = ?
    `, [hashedPassword, userId]);

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;