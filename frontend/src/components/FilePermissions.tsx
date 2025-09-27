import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, Eye, Edit, Trash2, Share2, X } from 'lucide-react';

interface FilePermission {
  id: number;
  file_id: number;
  user_id: number;
  username: string;
  email: string;
  permission: string;
  granted_by_username: string;
  created_at: string;
}

interface User {
  id: number;
  username: string;
  email: string;
}

interface FilePermissionsProps {
  fileId: number;
  fileName: string;
  onClose: () => void;
}

const FilePermissions: React.FC<FilePermissionsProps> = ({ fileId, fileName, onClose }) => {
  const [permissions, setPermissions] = useState<FilePermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<string>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const permissionTypes = [
    { value: 'view', label: 'View', icon: Eye, color: 'blue' },
    { value: 'edit', label: 'Edit', icon: Edit, color: 'yellow' },
    { value: 'delete', label: 'Delete', icon: Trash2, color: 'red' },
    { value: 'share', label: 'Share', icon: Share2, color: 'green' },
  ];

  useEffect(() => {
    fetchPermissions();
    fetchUsers();
  }, [fileId]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to manage this file');
          return;
        }
        throw new Error('Failed to fetch permissions');
      }

      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setError('Failed to fetch permissions');
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const grantPermission = async () => {
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          permission: selectedPermission,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to grant permission');
      }

      await fetchPermissions();
      setSelectedUserId('');
      setSelectedPermission('view');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to grant permission');
      console.error('Error granting permission:', err);
    }
  };

  const revokePermission = async (userId: number, permission: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/permissions/${userId}/${permission}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to revoke permission');
      }

      await fetchPermissions();
    } catch (err) {
      setError('Failed to revoke permission');
      console.error('Error revoking permission:', err);
    }
  };

  const getPermissionIcon = (permission: string) => {
    const perm = permissionTypes.find(p => p.value === permission);
    if (!perm) return null;
    const Icon = perm.icon;
    return <Icon className="w-4 h-4" />;
  };

  const getPermissionColor = (permission: string) => {
    const perm = permissionTypes.find(p => p.value === permission);
    if (!perm) return 'gray';
    const colors = {
      blue: 'bg-blue-100 text-blue-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
      green: 'bg-green-100 text-green-800',
    };
    return colors[perm.color as keyof typeof colors] || colors.blue;
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <Shield className="mr-2" />
              File Permissions
            </h2>
            <p className="text-gray-600 mt-1">{fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 p-3 rounded mb-4 text-red-700">
            {error}
          </div>
        )}

        {/* Grant Permission Section */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3 flex items-center">
            <UserPlus className="mr-2 w-5 h-5" />
            Grant Permission
          </h3>
          <div className="flex space-x-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-2"
              />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select a user</option>
                {filteredUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <select
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              {permissionTypes.map(perm => (
                <option key={perm.value} value={perm.value}>
                  {perm.label}
                </option>
              ))}
            </select>
            <button
              onClick={grantPermission}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Grant
            </button>
          </div>
        </div>

        {/* Permissions List */}
        <div>
          <h3 className="font-semibold mb-3">Current Permissions</h3>
          {loading ? (
            <div className="text-center py-4">Loading permissions...</div>
          ) : permissions.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No permissions granted yet
            </div>
          ) : (
            <div className="space-y-2">
              {permissions.map(perm => (
                <div key={`${perm.user_id}-${perm.permission}`} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium">{perm.username}</p>
                      <p className="text-sm text-gray-600">{perm.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPermissionColor(perm.permission)}`}>
                      {getPermissionIcon(perm.permission)}
                      <span className="ml-1">{perm.permission}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-500">
                      Granted by {perm.granted_by_username}
                      <br />
                      {new Date(perm.created_at).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => revokePermission(perm.user_id, perm.permission)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePermissions;