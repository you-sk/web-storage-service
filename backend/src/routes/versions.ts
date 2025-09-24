import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { db, runQuery, runInsert, runSingle } from '../config/database';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const uploadPath = process.env.UPLOAD_PATH || '/app/uploads';
const versionsPath = path.join(uploadPath, 'versions');

// Ensure versions directory exists
if (!fs.existsSync(versionsPath)) {
  fs.mkdirSync(versionsPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, versionsPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Get all versions of a file
router.get('/files/:fileId/versions', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  try {
    const fileId = req.params.fileId;
    const userId = (req as any).user.id;

    // Check if user owns the file
    const file = await runSingle<any>(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get all versions of the file
    const versions = await runQuery(`
      SELECT
        fv.*,
        u.username as created_by_username
      FROM file_versions fv
      JOIN users u ON fv.created_by = u.id
      WHERE fv.file_id = ?
      ORDER BY fv.version_number DESC
    `, [fileId]);

    // Include current version as latest
    const currentVersion = {
      id: null,
      file_id: file.id,
      version_number: (versions[0]?.version_number || 0) + 1,
      filename: file.filename,
      original_name: file.original_name,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      metadata: file.metadata,
      change_description: 'Current version',
      created_by: userId,
      created_by_username: (req as any).user.username,
      created_at: file.updated_at,
      is_current: true
    };

    return res.json({
      current: currentVersion,
      versions: versions
    });
  } catch (error) {
    console.error('Error fetching file versions:', error);
    return res.status(500).json({ error: 'Failed to fetch file versions' });
  }
});

// Upload a new version of a file
router.post('/files/:fileId/versions', authenticateToken, upload.single('file'), async (req: Request, res: Response): Promise<Response> => {
  try {
    const fileId = req.params.fileId;
    const userId = (req as any).user.id;
    const { change_description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if user owns the file
    const currentFile = await runSingle<any>(
      'SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [fileId, userId]
    );

    if (!currentFile) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get the latest version number
    const latestVersion = await runSingle<any>(
      'SELECT MAX(version_number) as max_version FROM file_versions WHERE file_id = ?',
      [fileId]
    );

    const newVersionNumber = (latestVersion?.max_version || 0) + 1;

    // Save current file as a version before updating
    await runInsert(
      `INSERT INTO file_versions (
        file_id, version_number, filename, original_name,
        mimetype, size, path, metadata, change_description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        newVersionNumber,
        currentFile.filename,
        currentFile.original_name,
        currentFile.mimetype,
        currentFile.size,
        currentFile.path,
        currentFile.metadata,
        'Previous version before update',
        userId
      ]
    );

    // Update the main file with new version
    await db.run(
      `UPDATE files
       SET filename = ?, original_name = ?, mimetype = ?, size = ?, path = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        fileId
      ]
    );

    // Create version entry for the new upload
    const versionId = await runInsert(
      `INSERT INTO file_versions (
        file_id, version_number, filename, original_name,
        mimetype, size, path, metadata, change_description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        newVersionNumber + 1,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        currentFile.metadata,
        change_description || 'New version uploaded',
        userId
      ]
    );

    return res.json({
      message: 'New version uploaded successfully',
      version: {
        id: versionId,
        version_number: newVersionNumber + 1,
        filename: req.file.filename,
        original_name: req.file.originalname,
        change_description: change_description || 'New version uploaded'
      }
    });
  } catch (error) {
    console.error('Error uploading new version:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to upload new version' });
  }
});

// Restore a specific version
router.post('/files/:fileId/versions/:versionId/restore', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { fileId, versionId } = req.params;
    const userId = (req as any).user.id;

    // Check if user owns the file
    const file = await runSingle<any>(
      'SELECT * FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [fileId, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get the version to restore
    const version = await runSingle<any>(
      'SELECT * FROM file_versions WHERE id = ? AND file_id = ?',
      [versionId, fileId]
    );

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Get the next version number
    const latestVersion = await runSingle<any>(
      'SELECT MAX(version_number) as max_version FROM file_versions WHERE file_id = ?',
      [fileId]
    );

    const newVersionNumber = (latestVersion?.max_version || 0) + 1;

    // Save current file as a version before restoring
    await runInsert(
      `INSERT INTO file_versions (
        file_id, version_number, filename, original_name,
        mimetype, size, path, metadata, change_description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        newVersionNumber,
        file.filename,
        file.original_name,
        file.mimetype,
        file.size,
        file.path,
        file.metadata,
        'Before restoring to version ' + version.version_number,
        userId
      ]
    );

    // Copy the version file to main uploads directory
    const restoredFilename = `restored-${Date.now()}-${version.filename}`;
    const restoredPath = path.join(uploadPath, restoredFilename);

    if (fs.existsSync(version.path)) {
      fs.copyFileSync(version.path, restoredPath);
    } else {
      return res.status(404).json({ error: 'Version file not found on disk' });
    }

    // Update the main file with the restored version
    await db.run(
      `UPDATE files
       SET filename = ?, original_name = ?, mimetype = ?, size = ?, path = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        restoredFilename,
        version.original_name,
        version.mimetype,
        version.size,
        restoredPath,
        version.metadata,
        fileId
      ]
    );

    return res.json({
      message: `File restored to version ${version.version_number} successfully`,
      restored_version: version.version_number
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    return res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Download a specific version
router.get('/files/:fileId/versions/:versionId/download', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { fileId, versionId } = req.params;
    const userId = (req as any).user.id;

    // Check if user owns the file
    const file = await runSingle(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get the version
    const version = await runSingle<any>(
      'SELECT * FROM file_versions WHERE id = ? AND file_id = ?',
      [versionId, fileId]
    );

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (!fs.existsSync(version.path)) {
      return res.status(404).json({ error: 'Version file not found on disk' });
    }

    return res.download(version.path, version.original_name);
  } catch (error) {
    console.error('Error downloading version:', error);
    return res.status(500).json({ error: 'Failed to download version' });
  }
});

// Delete a specific version
router.delete('/files/:fileId/versions/:versionId', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { fileId, versionId } = req.params;
    const userId = (req as any).user.id;

    // Check if user owns the file
    const file = await runSingle(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get the version
    const version = await runSingle<any>(
      'SELECT * FROM file_versions WHERE id = ? AND file_id = ?',
      [versionId, fileId]
    );

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Delete the version file from disk
    if (fs.existsSync(version.path)) {
      fs.unlinkSync(version.path);
    }

    // Delete the version from database
    await db.run(
      'DELETE FROM file_versions WHERE id = ?',
      [versionId]
    );

    return res.json({ message: 'Version deleted successfully' });
  } catch (error) {
    console.error('Error deleting version:', error);
    return res.status(500).json({ error: 'Failed to delete version' });
  }
});

// Compare two versions
router.get('/files/:fileId/versions/compare', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { fileId } = req.params;
    const { v1, v2 } = req.query;
    const userId = (req as any).user.id;

    if (!v1 || !v2) {
      return res.status(400).json({ error: 'Please provide v1 and v2 version IDs to compare' });
    }

    // Check if user owns the file
    const file = await runSingle(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [fileId, userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get both versions
    const version1 = await runSingle<any>(
      'SELECT * FROM file_versions WHERE id = ? AND file_id = ?',
      [v1, fileId]
    );

    const version2 = await runSingle<any>(
      'SELECT * FROM file_versions WHERE id = ? AND file_id = ?',
      [v2, fileId]
    );

    if (!version1 || !version2) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    return res.json({
      version1: {
        id: version1.id,
        version_number: version1.version_number,
        original_name: version1.original_name,
        size: version1.size,
        change_description: version1.change_description,
        created_at: version1.created_at,
        metadata: JSON.parse(version1.metadata || '{}')
      },
      version2: {
        id: version2.id,
        version_number: version2.version_number,
        original_name: version2.original_name,
        size: version2.size,
        change_description: version2.change_description,
        created_at: version2.created_at,
        metadata: JSON.parse(version2.metadata || '{}')
      },
      differences: {
        size_diff: version2.size - version1.size,
        time_diff: new Date(version2.created_at).getTime() - new Date(version1.created_at).getTime()
      }
    });
  } catch (error) {
    console.error('Error comparing versions:', error);
    return res.status(500).json({ error: 'Failed to compare versions' });
  }
});

export default router;