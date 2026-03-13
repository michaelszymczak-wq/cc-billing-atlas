import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, updateUserRole, deleteUser, getResetLink, UserInfo } from '../api/client';
import { UserRole } from '../auth/AuthContext';

export default function UserManagement() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('team_member');
  const [creating, setCreating] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setCreating(true);
    setError(null);
    setResetLink(null);
    try {
      const result = await createUser(newEmail, newRole);
      setResetLink(result.resetLink);
      setNewEmail('');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      await updateUserRole(uid, role);
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await deleteUser(uid);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleResetLink = async (uid: string) => {
    try {
      const link = await getResetLink(uid);
      setResetLink(link);
    } catch (err: any) {
      alert(err.message || 'Failed to generate link');
    }
  };

  const roleLabel = (r: string) => {
    switch (r) {
      case 'admin': return 'Admin';
      case 'team_member': return 'Team Member';
      case 'cellar': return 'Cellar';
      default: return r;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">User Management</h2>

      {/* Add user form */}
      <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New User</h3>
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{error}</div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="admin">Admin</option>
            <option value="team_member">Team Member</option>
            <option value="cellar">Cellar</option>
          </select>
          <button
            type="submit"
            disabled={creating || !newEmail}
            className="px-4 py-2 bg-violet-600 text-white text-sm rounded hover:bg-violet-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Add User'}
          </button>
        </div>
      </form>

      {/* Reset/welcome link display */}
      {resetLink && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-2">Password set link (share with user):</p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={resetLink}
              className="flex-1 border border-green-300 rounded px-3 py-2 text-sm bg-white font-mono text-xs"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(resetLink); }}
              className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setResetLink(null)}
            className="mt-2 text-xs text-green-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading users...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700">{u.email}</td>
                  <td className="px-4 py-2 text-sm">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="team_member">Team Member</option>
                      <option value="cellar">Cellar</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetLink(u.uid)}
                        className="px-2 py-1 text-xs border border-indigo-200 text-indigo-600 rounded hover:bg-indigo-50"
                      >
                        Reset Link
                      </button>
                      <button
                        onClick={() => handleDelete(u.uid, u.email)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
