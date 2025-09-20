import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { runQuery, runInsert, runSingle, runDelete } from '../config/database';

const router = Router();

// Get all folders for the current user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const folders = await runQuery(
      `SELECT id, name, parent_id, created_at, updated_at
       FROM folders
       WHERE user_id = ?
       ORDER BY parent_id NULLS FIRST, name`,
      [req.userId]
    );

    return res.json({ folders });
  } catch (error) {
    console.error('Get folders error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get folder by ID with its contents
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const folderId = req.params.id === 'root' ? null : req.params.id;

    // Get folder details if not root
    let folder = null;
    if (folderId) {
      folder = await runSingle(
        `SELECT * FROM folders WHERE id = ? AND user_id = ?`,
        [folderId, req.userId]
      );

      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    // Get subfolders
    const subfolders = await runQuery(
      `SELECT id, name, parent_id, created_at
       FROM folders
       WHERE user_id = ? AND ${folderId ? 'parent_id = ?' : 'parent_id IS NULL'}
       ORDER BY name`,
      folderId ? [req.userId, folderId] : [req.userId]
    );

    // Get files in this folder
    const files = await runQuery(
      `SELECT id, filename, original_name, mimetype, size, metadata, is_public, public_id, created_at
       FROM files
       WHERE user_id = ? AND ${folderId ? 'folder_id = ?' : 'folder_id IS NULL'}
       ORDER BY original_name`,
      folderId ? [req.userId, folderId] : [req.userId]
    );

    // Get breadcrumb path
    const breadcrumbs = [];
    let currentId = folderId;
    while (currentId) {
      const parent = await runSingle(
        `SELECT id, name, parent_id FROM folders WHERE id = ? AND user_id = ?`,
        [currentId, req.userId]
      );
      if (parent) {
        breadcrumbs.unshift({ id: parent.id, name: parent.name });
        currentId = parent.parent_id;
      } else {
        break;
      }
    }

    return res.json({
      folder,
      breadcrumbs,
      subfolders,
      files
    });
  } catch (error) {
    console.error('Get folder details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new folder
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { name, parentId } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Check if parent folder exists and belongs to user
    if (parentId) {
      const parentFolder = await runSingle(
        `SELECT id FROM folders WHERE id = ? AND user_id = ?`,
        [parentId, req.userId]
      );

      if (!parentFolder) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
    }

    // Check for duplicate folder name in same parent
    const duplicate = await runSingle(
      `SELECT id FROM folders
       WHERE user_id = ? AND name = ? AND ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}`,
      parentId ? [req.userId, name, parentId] : [req.userId, name]
    );

    if (duplicate) {
      return res.status(400).json({ error: 'A folder with this name already exists in this location' });
    }

    const folderId = await runInsert(
      `INSERT INTO folders (user_id, name, parent_id) VALUES (?, ?, ?)`,
      [req.userId, name.trim(), parentId || null]
    );

    const newFolder = await runSingle(
      `SELECT * FROM folders WHERE id = ?`,
      [folderId]
    );

    return res.status(201).json({
      message: 'Folder created successfully',
      folder: newFolder
    });
  } catch (error) {
    console.error('Create folder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update folder name
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { name } = req.body;
    const folderId = req.params.id;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await runSingle(
      `SELECT * FROM folders WHERE id = ? AND user_id = ?`,
      [folderId, req.userId]
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check for duplicate name in same parent
    const duplicate = await runSingle(
      `SELECT id FROM folders
       WHERE user_id = ? AND name = ? AND id != ?
       AND ${folder.parent_id ? 'parent_id = ?' : 'parent_id IS NULL'}`,
      folder.parent_id
        ? [req.userId, name, folderId, folder.parent_id]
        : [req.userId, name, folderId]
    );

    if (duplicate) {
      return res.status(400).json({ error: 'A folder with this name already exists in this location' });
    }

    await runQuery(
      `UPDATE folders
       SET name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [name.trim(), folderId, req.userId]
    );

    return res.json({
      message: 'Folder renamed successfully'
    });
  } catch (error) {
    console.error('Update folder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Move folder to a different parent
router.put('/:id/move', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { parentId } = req.body;
    const folderId = req.params.id;

    const folder = await runSingle(
      `SELECT * FROM folders WHERE id = ? AND user_id = ?`,
      [folderId, req.userId]
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if new parent exists and belongs to user
    if (parentId) {
      const parentFolder = await runSingle(
        `SELECT id FROM folders WHERE id = ? AND user_id = ?`,
        [parentId, req.userId]
      );

      if (!parentFolder) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }

      // Check for circular reference
      let currentId = parentId;
      while (currentId) {
        if (currentId === folderId) {
          return res.status(400).json({ error: 'Cannot move folder into its own subfolder' });
        }
        const parent = await runSingle(
          `SELECT parent_id FROM folders WHERE id = ? AND user_id = ?`,
          [currentId, req.userId]
        );
        currentId = parent?.parent_id;
      }
    }

    // Check for duplicate name in new location
    const duplicate = await runSingle(
      `SELECT id FROM folders
       WHERE user_id = ? AND name = ? AND id != ?
       AND ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}`,
      parentId ? [req.userId, folder.name, folderId, parentId] : [req.userId, folder.name, folderId]
    );

    if (duplicate) {
      return res.status(400).json({ error: 'A folder with this name already exists in the destination' });
    }

    await runQuery(
      `UPDATE folders
       SET parent_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [parentId || null, folderId, req.userId]
    );

    return res.json({
      message: 'Folder moved successfully'
    });
  } catch (error) {
    console.error('Move folder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete folder (and all contents)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const folderId = req.params.id;

    const folder = await runSingle(
      `SELECT * FROM folders WHERE id = ? AND user_id = ?`,
      [folderId, req.userId]
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Delete will cascade to subfolders and set files' folder_id to NULL
    const deletedCount = await runDelete(
      `DELETE FROM folders WHERE id = ? AND user_id = ?`,
      [folderId, req.userId]
    );

    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    return res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;