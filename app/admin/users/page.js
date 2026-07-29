'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, X, Edit, Trash2, DollarSign } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null for create, object for edit
  const [formData, setFormData] = useState({
    email: '', password: '', role: 'user', membershipLevel: 'FREE', balance: 0
  });

  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null, email: '' });
  const [rechargeDialog, setRechargeDialog] = useState({ isOpen: false, userId: null, amountStr: '' });

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchUsers(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '', // Don't show existing password
        role: user.role,
        membershipLevel: user.membershipLevel,
        balance: user.balance
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '', password: '', role: 'user', membershipLevel: 'FREE', balance: 0
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email) return toast.error('邮箱必填');
    if (!editingUser && !formData.password) return toast.error('创建用户时密码必填');

    const payload = { ...formData };
    if (!payload.password) delete payload.password; // Don't send empty password on edit

    const url = editingUser ? `/api/admin/users/${editingUser._id}` : '/api/admin/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(editingUser ? '用户已更新' : '用户创建成功');
        closeModal();
        fetchUsers();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (err) {
      toast.error('请求异常');
    }
  };

  const handleDeleteClick = (id, email) => {
    setDeleteDialog({ isOpen: true, id, email });
  };

  const executeDelete = async () => {
    const { id } = deleteDialog;
    setDeleteDialog({ isOpen: false, id: null, email: '' });
    if (!id) return;
    
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('删除成功');
        fetchUsers();
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('请求异常');
    }
  };

  const handleRechargeClick = (userId) => {
    setRechargeDialog({ isOpen: true, userId, amountStr: '' });
  };

  const executeRecharge = async () => {
    const { userId, amountStr } = rechargeDialog;
    setRechargeDialog({ isOpen: false, userId: null, amountStr: '' });
    if (!userId) return;

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount)) return toast.error('请输入有效数字');

    try {
      const res = await fetch('/api/admin/users/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, description: '后台手工充值' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('充值成功，最新余额: ' + data.balance);
        fetchUsers();
      } else {
        toast.error('充值失败: ' + data.error);
      }
    } catch (e) {
      toast.error('请求异常');
    }
  };

  if (loading) return <div style={{ padding: '32px' }}>加载中...</div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', letterSpacing: '-0.03em', fontWeight: 800, margin: 0 }}>用户管理</h1>
        <button 
          onClick={() => openModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 24px', background: 'var(--primary)', color: 'white',
            borderRadius: '16px', fontWeight: 600, border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={18} /> 新增用户
        </button>
      </div>

      <div className="premium-stat-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="premium-table">
            <thead>
              <tr>
                <th>邮箱账号</th>
                <th>角色</th>
                <th>会员等级</th>
                <th>当前余额（Credits）</th>
                <th>注册时间</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${u.membershipLevel?.toLowerCase() || 'free'}`}>
                      {u.membershipLevel || 'FREE'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.1rem', color: u.balance > 0 ? 'var(--primary)' : 'var(--text-main)' }}>{u.balance.toLocaleString()}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleRechargeClick(u._id)}
                        style={{ padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--primary)', cursor: 'pointer' }}
                        title="充值/扣款"
                      >
                        <DollarSign size={16} />
                      </button>
                      <button 
                        onClick={() => openModal(u)}
                        style={{ padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)', cursor: 'pointer' }}
                        title="编辑"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(u._id, u.email)}
                        style={{ padding: '8px', background: 'transparent', border: '1px solid #fee2e2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>暂无用户</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
        }}>
          <div style={{
            background: 'white', borderRadius: '24px', padding: '32px',
            width: '100%', maxWidth: '480px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{editingUser ? '编辑用户' : '新增用户'}</h2>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>邮箱账号</label>
                <input required type="email" className="input-base" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>密码 {editingUser && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(留空表示不修改)</span>}</label>
                <input type="password" placeholder={editingUser ? '留空不修改' : '必填'} className="input-base" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>角色</label>
                  <select className="input-base" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>会员等级</label>
                  <select className="input-base" value={formData.membershipLevel} onChange={e => setFormData({...formData, membershipLevel: e.target.value})}>
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Credits 余额</label>
                <input type="number" className="input-base" value={formData.balance} onChange={e => setFormData({...formData, balance: parseInt(e.target.value) || 0})} />
              </div>
              
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={closeModal} style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--background)', fontWeight: 600, color: 'var(--text-main)', border: 'none', cursor: 'pointer' }}>取消</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: '12px' }}>{editingUser ? '保存修改' : '确认创建'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setDeleteDialog({ isOpen: false, id: null, email: '' })}></div>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '400px', position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={24} style={{ color: 'var(--danger, #ef4444)' }} />
              删除确认
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              确定要永久删除用户 <strong>{deleteDialog.email}</strong> 吗？<br/>注意：相关日志仍会保留以便审计。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setDeleteDialog({ isOpen: false, id: null, email: '' })}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}
              >
                取消
              </button>
              <button 
                onClick={executeDelete}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--danger, #ef4444)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recharge Prompt Dialog */}
      {rechargeDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setRechargeDialog({ isOpen: false, userId: null, amountStr: '' })}></div>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '90%', maxWidth: '400px', position: 'relative', zIndex: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={24} style={{ color: 'var(--primary)' }} />
              后台手工充值/扣款
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              请输入 Credits 数量，支持输入负数进行人工余额调整。
            </p>
            <input 
              type="number" 
              autoFocus
              value={rechargeDialog.amountStr}
              onChange={e => setRechargeDialog({ ...rechargeDialog, amountStr: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && executeRecharge()}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--primary)', outline: 'none', fontSize: '1.1rem', marginBottom: '24px' }}
              placeholder="例如: 1000 或 -500"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setRechargeDialog({ isOpen: false, userId: null, amountStr: '' })}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}
              >
                取消
              </button>
              <button 
                onClick={executeRecharge}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
