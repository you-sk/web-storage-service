import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../data/storage.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mimetype TEXT,
          size INTEGER,
          path TEXT NOT NULL,
          metadata TEXT,
          is_public INTEGER DEFAULT 0,
          public_id TEXT UNIQUE,
          folder_id INTEGER,
          deleted_at DATETIME DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating files table:', err);
          reject(err);
          return;
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating tags table:', err);
          reject(err);
          return;
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS file_tags (
          file_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (file_id, tag_id),
          FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating file_tags table:', err);
          reject(err);
          return;
        }
      });

      // Create folders table
      db.run(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          parent_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating folders table:', err);
          reject(err);
          return;
        }

        // Add folder_id to files table if it doesn't exist
        db.run(`ALTER TABLE files ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding folder_id column:', err);
          }
        });

        // Add is_public and public_id columns to existing files table if they don't exist
        db.run(`ALTER TABLE files ADD COLUMN is_public INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding is_public column:', err);
          }
        });

        db.run(`ALTER TABLE files ADD COLUMN public_id TEXT UNIQUE`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding public_id column:', err);
          }
        });

        // Add deleted_at column for soft delete functionality
        db.run(`ALTER TABLE files ADD COLUMN deleted_at DATETIME DEFAULT NULL`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding deleted_at column:', err);
          }
        });

        // Create comments table
        db.run(`
          CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            parent_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error creating comments table:', err);
            reject(err);
            return;
          }

          // Create file_versions table for version control
          db.run(`
            CREATE TABLE IF NOT EXISTS file_versions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_id INTEGER NOT NULL,
              version_number INTEGER NOT NULL,
              filename TEXT NOT NULL,
              original_name TEXT NOT NULL,
              mimetype TEXT,
              size INTEGER,
              path TEXT NOT NULL,
              metadata TEXT,
              change_description TEXT,
              created_by INTEGER NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
              FOREIGN KEY (created_by) REFERENCES users (id),
              UNIQUE (file_id, version_number)
            )
          `, (err) => {
            if (err) {
              console.error('Error creating file_versions table:', err);
              reject(err);
              return;
            }

            // Add role column to users table if it doesn't exist
            db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding role column:', err);
              }
            });

            // Create permissions table
            db.run(`
              CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) {
                console.error('Error creating permissions table:', err);
                reject(err);
                return;
              }

              // Create role_permissions junction table
              db.run(`
                CREATE TABLE IF NOT EXISTS role_permissions (
                  role TEXT NOT NULL,
                  permission_id INTEGER NOT NULL,
                  PRIMARY KEY (role, permission_id),
                  FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
                )
              `, (err) => {
                if (err) {
                  console.error('Error creating role_permissions table:', err);
                  reject(err);
                  return;
                }

                // Create file_permissions table for granular file access control
                db.run(`
                  CREATE TABLE IF NOT EXISTS file_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    permission TEXT NOT NULL CHECK(permission IN ('view', 'edit', 'delete', 'share')),
                    granted_by INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY (granted_by) REFERENCES users (id),
                    UNIQUE (file_id, user_id, permission)
                  )
                `, (err) => {
                  if (err) {
                    console.error('Error creating file_permissions table:', err);
                    reject(err);
                    return;
                  }

                  // Insert default permissions
                  const defaultPermissions = [
                    ['manage_users', 'Create, update, and delete user accounts'],
                    ['manage_roles', 'Assign and revoke user roles'],
                    ['view_all_files', 'View all files in the system'],
                    ['delete_all_files', 'Delete any file in the system'],
                    ['manage_system', 'Access to system configuration and settings'],
                    ['create_folders', 'Create new folders'],
                    ['delete_folders', 'Delete folders'],
                    ['share_files', 'Share files with other users'],
                    ['manage_tags', 'Create and delete tags'],
                    ['moderate_comments', 'Edit or delete any comment']
                  ];

                  let insertCount = 0;
                  defaultPermissions.forEach(([name, description]) => {
                    db.run(
                      `INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)`,
                      [name, description],
                      (err) => {
                        if (err) {
                          console.error(`Error inserting permission ${name}:`, err);
                        }
                        insertCount++;
                        if (insertCount === defaultPermissions.length) {
                          // Assign all permissions to admin role
                          db.run(
                            `INSERT OR IGNORE INTO role_permissions (role, permission_id)
                             SELECT 'admin', id FROM permissions`,
                            (err) => {
                              if (err) {
                                console.error('Error assigning admin permissions:', err);
                              }

                              // Assign basic permissions to user role
                              const userPermissions = ['create_folders', 'share_files'];
                              userPermissions.forEach(permission => {
                                db.run(
                                  `INSERT OR IGNORE INTO role_permissions (role, permission_id)
                                   SELECT 'user', id FROM permissions WHERE name = ?`,
                                  [permission],
                                  (err) => {
                                    if (err) {
                                      console.error(`Error assigning user permission ${permission}:`, err);
                                    }
                                  }
                                );
                              });

                              console.log('Database tables created successfully');
                              resolve();
                            }
                          );
                        }
                      }
                    );
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

export const runQuery = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
};

export const runSingle = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T);
      }
    });
  });
};

export const runInsert = (sql: string, params: any[] = []): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

export const runDelete = (sql: string, params: any[] = []): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};