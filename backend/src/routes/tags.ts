import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { runQuery, runInsert, runSingle, runDelete } from '../config/database';

const router = Router();

router.get('/', authenticateToken, async (_req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const tags = await runQuery(`SELECT * FROM tags ORDER BY name`);
    return res.json({ tags });
  } catch (error) {
    console.error('Get tags error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, checkPermission('manage_tags'), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const existingTag = await runSingle(`SELECT * FROM tags WHERE name = ?`, [name]);
    if (existingTag) {
      return res.status(409).json({ error: 'Tag already exists' });
    }

    const tagId = await runInsert(`INSERT INTO tags (name) VALUES (?)`, [name]);

    return res.status(201).json({
      message: 'Tag created successfully',
      tag: { id: tagId, name }
    });
  } catch (error) {
    console.error('Create tag error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, checkPermission('manage_tags'), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    await runDelete(`DELETE FROM file_tags WHERE tag_id = ?`, [req.params.id]);
    
    const deletedCount = await runDelete(`DELETE FROM tags WHERE id = ?`, [req.params.id]);

    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    return res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete tag error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/file/:fileId', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { fileId } = req.params;
    const { tagIds } = req.body;

    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'Tag IDs array is required' });
    }

    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [fileId, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await runDelete(`DELETE FROM file_tags WHERE file_id = ?`, [fileId]);

    for (const tagId of tagIds) {
      await runInsert(
        `INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)`,
        [fileId, tagId]
      );
    }

    return res.json({ message: 'Tags updated successfully' });
  } catch (error) {
    console.error('Update file tags error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/file/:fileId', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { fileId } = req.params;

    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [fileId, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const tags = await runQuery(
      `SELECT t.* FROM tags t 
       INNER JOIN file_tags ft ON t.id = ft.tag_id 
       WHERE ft.file_id = ?`,
      [fileId]
    );

    return res.json({ tags });
  } catch (error) {
    console.error('Get file tags error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;