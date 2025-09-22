import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { runQuery, runSingle, runInsert, runDelete } from '../config/database';

const router = express.Router();

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthRequest extends Request {
  user?: User;
}

interface Comment {
  id: number;
  file_id: number;
  user_id: number;
  content: string;
  parent_id?: number;
  created_at: string;
  updated_at: string;
  username?: string;
  replies?: Comment[];
}

// Get all comments for a file
router.get('/files/:fileId/comments', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fileId = req.params.fileId;
    const userId = req.user?.id;

    // Check if user has access to the file
    const file = await runSingle<{ id: number; user_id: number; is_public: number }>(
      'SELECT id, user_id, is_public FROM files WHERE id = ?',
      [fileId]
    );

    if (!file) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    // Check access permissions
    if (file.user_id !== userId && file.is_public === 0) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Get all comments with user information
    const comments = await runQuery<Comment>(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.file_id = ?
       ORDER BY c.created_at DESC`,
      [fileId]
    );

    // Organize comments into a tree structure
    const commentMap = new Map<number, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map
    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    });

    // Second pass: build tree
    comments.forEach(comment => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies!.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    res.json(rootComments);
  } catch (error) {
    next(error);
  }
});

// Create a new comment
router.post('/files/:fileId/comments', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fileId = req.params.fileId;
    const userId = req.user?.id;
    const { content, parent_id } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Comment content is required' });
      return;
    }

    // Check if user has access to the file
    const file = await runSingle<{ id: number; user_id: number; is_public: number }>(
      'SELECT id, user_id, is_public FROM files WHERE id = ?',
      [fileId]
    );

    if (!file) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    // Check access permissions
    if (file.user_id !== userId && file.is_public === 0) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // If parent_id is provided, verify it exists and belongs to the same file
    if (parent_id) {
      const parentComment = await runSingle<{ id: number; file_id: number }>(
        'SELECT id, file_id FROM comments WHERE id = ? AND file_id = ?',
        [parent_id, fileId]
      );

      if (!parentComment) {
        res.status(400).json({ message: 'Parent comment not found or belongs to different file' });
        return;
      }
    }

    // Insert the comment
    const commentId = await runInsert(
      'INSERT INTO comments (file_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [fileId, userId, content.trim(), parent_id || null]
    );

    // Fetch the created comment with user info
    const newComment = await runSingle<Comment>(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    res.status(201).json(newComment);
  } catch (error) {
    next(error);
  }
});

// Update a comment
router.put('/comments/:commentId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user?.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Comment content is required' });
      return;
    }

    // Check if comment exists and user owns it
    const comment = await runSingle<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM comments WHERE id = ?',
      [commentId]
    );

    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    if (comment.user_id !== userId) {
      res.status(403).json({ message: 'You can only edit your own comments' });
      return;
    }

    // Update the comment
    await runQuery(
      'UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content.trim(), commentId]
    );

    // Fetch updated comment
    const updatedComment = await runSingle<Comment>(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    res.json(updatedComment);
  } catch (error) {
    next(error);
  }
});

// Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user?.id;

    // Check if comment exists and user owns it
    const comment = await runSingle<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM comments WHERE id = ?',
      [commentId]
    );

    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    if (comment.user_id !== userId) {
      res.status(403).json({ message: 'You can only delete your own comments' });
      return;
    }

    // Delete the comment (cascades to child comments due to FK constraint)
    const changes = await runDelete('DELETE FROM comments WHERE id = ?', [commentId]);

    if (changes > 0) {
      res.json({ message: 'Comment deleted successfully' });
    } else {
      res.status(500).json({ message: 'Failed to delete comment' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;