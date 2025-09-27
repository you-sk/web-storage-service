import React, { useState, useEffect } from 'react';
import { Search, Shield, User, UserCog, Eye, Trash2, RefreshCw, AlertCircle } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<{ [key: string]: Permission[] }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = ['admin', 'user', 'guest'];

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole);
    }
  }, [selectedRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to manage users');
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/permissions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const fetchRolePermissions = async (role: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/roles/${role}/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch role permissions');
      }

      const data = await response.json();
      setRolePermissions(prev => ({ ...prev, [role]: data }));
    } catch (err) {
      console.error('Error fetching role permissions:', err);
    }
  };

  const updateUserRole = async (userId: number, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to change user roles');
          return;
        }
        throw new Error('Failed to update user role');
      }

      await fetchUsers();
      setSelectedUser(null);
    } catch (err) {
      setError('Failed to update user role');
      console.error('Error updating user role:', err);
    }
  };

  const toggleRolePermission = async (role: string, permissionId: number, hasPermission: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const method = hasPermission ? 'DELETE' : 'POST';
      const url = hasPermission
        ? `/api/roles/${role}/permissions/${permissionId}`
        : `/api/roles/${role}/permissions`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: !hasPermission ? JSON.stringify({ permissionId }) : undefined,
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to modify role permissions');
          return;
        }
        throw new Error('Failed to update role permission');
      }

      await fetchRolePermissions(role);
    } catch (err) {
      setError('Failed to update role permission');
      console.error('Error updating role permission:', err);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'user':
        return <User className="w-4 h-4" />;
      case 'guest':
        return <Eye className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'user':
        return 'bg-blue-100 text-blue-800';
      case 'guest':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <UserCog className="mr-2" />
          User Management
        </h2>
        <button
          onClick={fetchUsers}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* User List */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Username</th>
                  <th className="text-left py-2 px-4">Email</th>
                  <th className="text-left py-2 px-4">Role</th>
                  <th className="text-left py-2 px-4">Created</th>
                  <th className="text-left py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{user.username}</td>
                    <td className="py-2 px-4">{user.email}</td>
                    <td className="py-2 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        <span className="ml-1">{user.role}</span>
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-4">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Role Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Change User Role</h3>
            <p className="mb-4">
              Change role for <strong>{selectedUser.username}</strong>
            </p>
            <select
              value={selectedUser.role}
              onChange={(e) => updateUserRole(selectedUser.id, e.target.value)}
              className="w-full p-2 border rounded mb-4"
            >
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Permissions Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Role Permissions</h3>
        <div className="mb-4">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="p-2 border rounded"
          >
            {roles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {permissions.map(permission => {
            const hasPermission = rolePermissions[selectedRole]?.some(p => p.id === permission.id);
            return (
              <div key={permission.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{permission.name}</p>
                  <p className="text-sm text-gray-600">{permission.description}</p>
                </div>
                <button
                  onClick={() => toggleRolePermission(selectedRole, permission.id, hasPermission)}
                  className={`px-3 py-1 rounded text-sm ${
                    hasPermission
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {hasPermission ? 'Granted' : 'Not Granted'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;