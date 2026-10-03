import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole, UserStatus } from '../../types';
import { storage } from '../../services/storage';
import {
  Users,
  Search,
  Plus,
  KeyRound,
  Shield,
  UserCheck,
  UserX,
  Edit3,
  Mail,
  Phone,
  Server,
  MoreVertical
} from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';

export const EmployeeScreen: React.FC = () => {
  const {
    users,
    currentUser,
    refreshData,
    showToast,
    createUserAccount,
    updateUserAccount,
    changeUserPassword,
    isBackendConnected
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create / Edit Modal & Action Menu
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Form matching UserCreateSchema & UserUpdateSchema
  const [userForm, setUserForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    gender_code: 'M',
    role: 'LABOUR' as UserRole,
    password: '',
    confirmPassword: '',
    status: 'ACTIVE' as UserStatus
  });

  // Password Change Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Status Change Confirmation Modal
  const [statusConfirmation, setStatusConfirmation] = useState<{
    user: User;
    nextStatus: UserStatus;
  } | null>(null);

  const handleOpenUserModal = (u?: User) => {
    if (u) {
      setEditingUser(u);
      setUserForm({
        username: u.username,
        first_name: u.first_name || u.name.split(' ')[0] || '',
        last_name: u.last_name || u.name.split(' ').slice(1).join(' ') || '',
        email: u.email || '',
        phone_number: u.phone_number || '',
        gender_code: u.gender_code || 'M',
        role: u.role,
        password: '',
        confirmPassword: '',
        status: u.status
      });
    } else {
      setEditingUser(null);
      setUserForm({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        gender_code: 'M',
        role: 'LABOUR',
        password: '',
        confirmPassword: '',
        status: 'ACTIVE'
      });
    }
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser && !userForm.username.trim()) {
      showToast('Username is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (!editingUser) {
        if (!userForm.password) {
          showToast('Password is required for new accounts', 'error');
          setSubmitting(false);
          return;
        }
        if (userForm.password !== userForm.confirmPassword) {
          showToast('Passwords do not match', 'error');
          setSubmitting(false);
          return;
        }

        await createUserAccount({
          username: userForm.username.trim(),
          password: userForm.password,
          role: userForm.role,
          first_name: userForm.first_name.trim(),
          last_name: userForm.last_name.trim(),
          email: userForm.email.trim() || undefined,
          phone_number: userForm.phone_number.trim() || undefined,
          gender_code: userForm.gender_code || undefined
        });

        setUserModalOpen(false);
      } else {
        await updateUserAccount(editingUser.id, {
          role: userForm.role,
          first_name: userForm.first_name.trim(),
          last_name: userForm.last_name.trim(),
          email: userForm.email.trim() || undefined,
          phone_number: userForm.phone_number.trim() || undefined,
          gender_code: userForm.gender_code || undefined
        });

        setUserModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPasswordModal = (u: User) => {
    setTargetUserForPassword(u);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordModalOpen(true);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPassword) return;
    if (!newPassword || newPassword.length < 4) {
      showToast('Password must be at least 4 characters long', 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    try {
      setSavingPassword(true);
      await changeUserPassword(targetUserForPassword.id, newPassword);
      setPasswordModalOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirmation) return;
    const { user, nextStatus } = statusConfirmation;
    try {
      await updateUserAccount(user.id, {
        role: user.role
      });
      storage.updateUser(user.id, { status: nextStatus });
      await refreshData();
      setStatusConfirmation(null);
      showToast(
        `Employee account ${user.name} has been ${nextStatus === 'ACTIVE' ? 'activated' : 'disabled'}`,
        'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update account status', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.phone_number && u.phone_number.includes(searchTerm));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Employee Administration
            </h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
              isBackendConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <Server className="w-2.5 h-2.5" />
              {isBackendConnected ? 'API Connected' : 'Offline Storage'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-based access management for Owners, Accountants, and Operational Labour staff via <code className="text-[11px] font-mono text-slate-600 bg-slate-200/60 px-1 py-0.5 rounded">api/users/</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenUserModal()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Employee Account
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee name, username, email, phone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="ALL">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="LABOUR">Labour / Operations</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Accounts</option>
          <option value="DISABLED">Disabled Accounts</option>
        </select>
      </div>

      {/* Status Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Status Color Legend:</span>
          <span className="text-[11px] text-slate-400">Rows are color-coded by account standing</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-2 ring-emerald-400/30'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600"></span>
            <span>Active Accounts</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 ml-0.5 font-bold">
              {users.filter(u => u.status === 'ACTIVE').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'DISABLED' ? 'ALL' : 'DISABLED')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'DISABLED'
                ? 'bg-rose-100 text-rose-900 border-rose-300 ring-2 ring-rose-400/30'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-600"></span>
            <span>Disabled Accounts</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-200/70 text-rose-900 ml-0.5 font-bold">
              {users.filter(u => u.status === 'DISABLED').length}
            </span>
          </button>
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Employee Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No employee accounts found matching filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isActive = u.status === 'ACTIVE';

                  // Row background & left border color by status
                  const rowBgClass = isActive
                    ? 'bg-emerald-50/20 hover:bg-emerald-100/40 border-l-4 border-l-emerald-500'
                    : 'bg-rose-50/30 hover:bg-rose-100/50 border-l-4 border-l-rose-400 text-slate-500';

                  return (
                    <tr key={u.id} className={`${rowBgClass} transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                            {u.name.charAt(0)}
                          </div>
                          <span>{u.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-blue-600 font-medium">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        @{u.username}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {u.email && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{u.email}</span>
                          </div>
                        )}
                        {u.phone_number && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{u.phone_number}</span>
                          </div>
                        )}
                        {!u.email && !u.phone_number && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            u.role === 'OWNER'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : u.role === 'ACCOUNTANT'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">
                        {u.createdAt || '-'}
                      </td>
                      {/* Actions: Vertical Three Dots with Dropdown */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === u.id ? null : u.id);
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white/80 rounded-lg border border-slate-200/60 shadow-2xs transition-colors cursor-pointer"
                            title="Employee Options"
                            aria-label="Employee Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionMenuId === u.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setOpenActionMenuId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenUserModal(u);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Edit Employee</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenPasswordModal(u);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 cursor-pointer"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Reset Password</span>
                                </button>

                                {!isCurrent && (
                                  <>
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setStatusConfirmation({
                                          user: u,
                                          nextStatus: isActive ? 'DISABLED' : 'ACTIVE'
                                        });
                                      }}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer ${
                                        isActive
                                          ? 'text-amber-700 hover:bg-amber-50'
                                          : 'text-emerald-700 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {isActive ? (
                                        <>
                                          <UserX className="w-3.5 h-3.5 text-amber-600" />
                                          <span>Disable Account</span>
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>Enable Account</span>
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT EMPLOYEE MODAL (SCHEMA-COMPLIANT) */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 border border-slate-200 my-8">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {editingUser ? `Edit Employee: @${editingUser.username}` : 'Create New Employee Account'}
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Integrated with <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">POST /api/users/</code> and <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">PATCH /api/users/{'{user_id}'}/</code>
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={userForm.first_name}
                    onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                    placeholder="e.g. Ramesh"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={userForm.last_name}
                    onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                    placeholder="e.g. Patel"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Username & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="e.g. ramesh_op"
                    className={`w-full text-xs border rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono ${
                      editingUser ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    System Role *
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white font-medium"
                  >
                    <option value="LABOUR">LABOUR (Operations Only)</option>
                    <option value="ACCOUNTANT">ACCOUNTANT (Financial Access)</option>
                    <option value="OWNER">OWNER (Full Administrator)</option>
                  </select>
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="ramesh@company.com"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={userForm.phone_number}
                    onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })}
                    placeholder="+91 98260 00000"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Gender Code */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gender Code (Optional)
                </label>
                <select
                  value={userForm.gender_code}
                  onChange={(e) => setUserForm({ ...userForm, gender_code: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                  <option value="O">Other (O)</option>
                </select>
              </div>

              {/* Password for new users */}
              {!editingUser && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Account Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="Min 4 characters"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={userForm.confirmPassword}
                      onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
                >
                  {submitting ? 'Saving to API...' : editingUser ? 'Save Updates' : 'Create User via API'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD DEDICATED MODAL */}
      {passwordModalOpen && targetUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Change Password for {targetUserForPassword.name}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Set a new login password for user <span className="font-mono text-slate-700 font-semibold">@{targetUserForPassword.username}</span> via <code className="text-[11px] font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded">/users/{targetUserForPassword.id}/password/</code>.
            </p>
            <form onSubmit={handleSaveNewPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  disabled={savingPassword}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 4 chars)"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  disabled={savingPassword}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:bg-slate-50"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingPassword}
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPassword ? 'Updating via API...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION FOR DISABLE/ENABLE */}
      <ConfirmationModal
        isOpen={!!statusConfirmation}
        title={statusConfirmation?.nextStatus === 'DISABLED' ? 'Disable Employee Account' : 'Activate Employee Account'}
        message={
          statusConfirmation?.nextStatus === 'DISABLED'
            ? `Are you sure you want to disable ${statusConfirmation?.user.name}? This employee will no longer be able to log in to the system. Historical business records and entries created by this employee will remain safely intact.`
            : `Are you sure you want to reactivate login access for ${statusConfirmation?.user.name}?`
        }
        confirmLabel={statusConfirmation?.nextStatus === 'DISABLED' ? 'Yes, Disable Access' : 'Yes, Activate'}
        variant={statusConfirmation?.nextStatus === 'DISABLED' ? 'danger' : 'primary'}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusConfirmation(null)}
      />
    </div>
  );
};
