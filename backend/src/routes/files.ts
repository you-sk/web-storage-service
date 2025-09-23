import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { runQuery, runInsert, runSingle, runDelete } from '../config/database';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || '/app/uploads';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760')
  }
});

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = req.body.metadata ? JSON.stringify(req.body.metadata) : null;
    const folderId = req.body.folderId || null;

    // Verify folder belongs to user if provided
    if (folderId) {
      const folder = await runSingle(
        `SELECT id FROM folders WHERE id = ? AND user_id = ?`,
        [folderId, req.userId]
      );
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    const fileId = await runInsert(
      `INSERT INTO files (user_id, filename, original_name, mimetype, size, path, metadata, is_public, public_id, folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        metadata,
        0,
        null,
        folderId
      ]
    );

    return res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload-multiple', authenticateToken, upload.array('files', 10), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const folderId = req.body.folderId || null;

    // Verify folder belongs to user if provided
    if (folderId) {
      const folder = await runSingle(
        `SELECT id FROM folders WHERE id = ? AND user_id = ?`,
        [folderId, req.userId]
      );
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    const uploadedFiles = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const metadata = req.body.metadata ? JSON.stringify(req.body.metadata) : null;

        const fileId = await runInsert(
          `INSERT INTO files (user_id, filename, original_name, mimetype, size, path, metadata, is_public, public_id, folder_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.userId,
            file.filename,
            file.originalname,
            file.mimetype,
            file.size,
            file.path,
            metadata,
            0,
            null,
            folderId
          ]
        );

        uploadedFiles.push({
          id: fileId,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size
        });
      } catch (error) {
        console.error(`Error uploading file ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: 'Failed to save to database'
        });

        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error(`Error deleting file ${file.filename}:`, err);
          }
        }
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({
        error: 'Failed to upload any files',
        errors
      });
    }

    return res.status(201).json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { folderId } = req.query;

    let sql = `SELECT id, filename, original_name, mimetype, size, metadata, is_public, public_id, folder_id, created_at
               FROM files WHERE user_id = ? AND deleted_at IS NULL`;
    const params: any[] = [req.userId];

    if (folderId === 'root') {
      sql += ` AND folder_id IS NULL`;
    } else if (folderId) {
      sql += ` AND folder_id = ?`;
      params.push(folderId);
    }

    sql += ` ORDER BY created_at DESC`;

    const files = await runQuery(sql, params);

    return res.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { query = '', tagIds = '', type = '', folderId = '' } = req.query;

    let sql = `
      SELECT DISTINCT f.id, f.filename, f.original_name, f.mimetype, f.size, f.metadata, f.is_public, f.public_id, f.folder_id, f.created_at
      FROM files f
      LEFT JOIN file_tags ft ON f.id = ft.file_id
      WHERE f.user_id = ? AND f.deleted_at IS NULL
    `;

    const params: any[] = [req.userId];

    if (query && typeof query === 'string') {
      sql += ` AND (f.original_name LIKE ? OR f.metadata LIKE ?)`;
      const searchPattern = `%${query}%`;
      params.push(searchPattern, searchPattern);
    }

    if (type && typeof type === 'string') {
      sql += ` AND f.mimetype LIKE ?`;
      params.push(`%${type}%`);
    }

    if (tagIds && typeof tagIds === 'string') {
      const tagIdArray = tagIds.split(',').filter(id => id);
      if (tagIdArray.length > 0) {
        sql += ` AND ft.tag_id IN (${tagIdArray.map(() => '?').join(',')})`;
        params.push(...tagIdArray);
      }
    }

    if (folderId && typeof folderId === 'string') {
      if (folderId === 'root') {
        sql += ` AND f.folder_id IS NULL`;
      } else {
        sql += ` AND f.folder_id = ?`;
        params.push(folderId);
      }
    }

    sql += ` ORDER BY f.created_at DESC`;

    const files = await runQuery(sql, params);

    return res.json({ files });
  } catch (error) {
    console.error('Search files error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/preview', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = file.path as string;
    const mimetype = file.mimetype as string;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // 画像ファイルのプレビュー
    if (mimetype.startsWith('image/')) {
      res.setHeader('Content-Type', mimetype);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(path.resolve(filePath));
    }

    // PDFファイルのプレビュー
    if (mimetype === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(path.resolve(filePath));
    }

    // テキストファイルのプレビュー
    const textMimeTypes = [
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'text/xml',
      'application/xml',
      'text/markdown',
      'text/csv'
    ];

    if (textMimeTypes.includes(mimetype) || mimetype.startsWith('text/')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const preview = content.length > 10000 ? content.substring(0, 10000) + '\n...(truncated)' : content;
      return res.json({
        type: 'text',
        content: preview,
        mimetype: mimetype,
        truncated: content.length > 10000
      });
    }

    // サポートされていないファイル形式
    return res.status(415).json({
      error: 'File type not supported for preview',
      mimetype: mimetype
    });

  } catch (error) {
    console.error('Preview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/download', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const filePath = file.path as string;

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    const originalName = file.original_name as string;

    res.download(filePath, originalName, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/metadata', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { metadata } = req.body;

    if (!metadata) {
      return res.status(400).json({ error: 'Metadata is required' });
    }

    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const metadataString = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

    await runQuery(
      `UPDATE files SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [metadataString, req.params.id, req.userId]
    );

    return res.json({
      message: 'Metadata updated successfully',
      metadata: JSON.parse(metadataString)
    });
  } catch (error) {
    console.error('Update metadata error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/visibility', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { isPublic } = req.body;

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be a boolean' });
    }

    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    let publicId = file.public_id as string | null;

    if (isPublic && !publicId) {
      publicId = crypto.randomBytes(16).toString('hex');
    } else if (!isPublic) {
      publicId = null;
    }

    await runQuery(
      `UPDATE files SET is_public = ?, public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [isPublic ? 1 : 0, publicId, req.params.id, req.userId]
    );

    return res.json({
      message: 'File visibility updated successfully',
      isPublic,
      publicId,
      publicUrl: publicId ? `/api/public/files/${publicId}` : null
    });
  } catch (error) {
    console.error('Update visibility error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/move', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { folderId } = req.body;
    const fileId = req.params.id;

    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [fileId, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify folder belongs to user if provided
    if (folderId) {
      const folder = await runSingle(
        `SELECT id FROM folders WHERE id = ? AND user_id = ?`,
        [folderId, req.userId]
      );
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    await runQuery(
      `UPDATE files
       SET folder_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [folderId || null, fileId, req.userId]
    );

    return res.json({
      message: 'File moved successfully'
    });
  } catch (error) {
    console.error('Move file error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Soft delete - Move to trash
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Soft delete - set deleted_at timestamp
    await runDelete(
      `UPDATE files SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    return res.json({ message: 'File moved to trash successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trash files
router.get('/trash/list', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const sql = `SELECT id, filename, original_name, mimetype, size, metadata, folder_id, deleted_at, created_at
                 FROM files WHERE user_id = ? AND deleted_at IS NOT NULL
                 ORDER BY deleted_at DESC`;

    const files = await runQuery(sql, [req.userId]);

    return res.json({ files });
  } catch (error) {
    console.error('Get trash files error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore file from trash
router.post('/:id/restore', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    // Restore file - clear deleted_at
    await runDelete(
      `UPDATE files SET deleted_at = NULL WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    return res.json({ message: 'File restored successfully' });
  } catch (error) {
    console.error('Restore error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete file from trash
router.delete('/:id/permanent', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    const filePath = file.path as string;

    // Delete physical file
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting file from disk:', err);
      }
    }

    // Permanently delete from database
    await runDelete(
      `DELETE FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    return res.json({ message: 'File permanently deleted' });
  } catch (error) {
    console.error('Permanent delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Empty trash - permanently delete all trashed files
router.delete('/trash/empty', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // Get all trashed files for the user
    const trashedFiles = await runQuery(
      `SELECT * FROM files WHERE user_id = ? AND deleted_at IS NOT NULL`,
      [req.userId]
    );

    // Delete physical files
    for (const file of trashedFiles as any[]) {
      const filePath = file.path as string;
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Error deleting file from disk:', err);
        }
      }
    }

    // Permanently delete from database
    const deletedCount = await runDelete(
      `DELETE FROM files WHERE user_id = ? AND deleted_at IS NOT NULL`,
      [req.userId]
    );

    return res.json({
      message: 'Trash emptied successfully',
      deletedCount
    });
  } catch (error) {
    console.error('Empty trash error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;