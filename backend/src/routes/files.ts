import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

    const fileId = await runInsert(
      `INSERT INTO files (user_id, filename, original_name, mimetype, size, path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        metadata
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

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const files = await runQuery(
      `SELECT id, filename, original_name, mimetype, size, metadata, created_at
       FROM files WHERE user_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );

    return res.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { query = '', tagIds = '', type = '' } = req.query;

    let sql = `
      SELECT DISTINCT f.id, f.filename, f.original_name, f.mimetype, f.size, f.metadata, f.created_at
      FROM files f
      LEFT JOIN file_tags ft ON f.id = ft.file_id
      WHERE f.user_id = ?
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

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = file.path as string;

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting file from disk:', err);
      }
    }

    const deletedCount = await runDelete(
      `DELETE FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (deletedCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;