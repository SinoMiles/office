import User from '@/models/User';
import Task from '@/models/Task';
import BillingRecord from '@/models/BillingRecord';
import { connectToDatabase } from '@/lib/db';
import { Users, FileSpreadsheet, Activity, DollarSign } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  await connectToDatabase();
  
  const totalUsers = await User.countDocuments();
  const totalTasks = await Task.countDocuments();
  
  // Aggregate revenue
  const revenueResult = await BillingRecord.aggregate([
    { $match: { type: 'consume' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '8px', letterSpacing: '-0.03em', fontWeight: 800 }}>
        欢迎回来，<span className="text-gradient">Administrator</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>这里是系统的运行概况与核心数据。</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        {/* Card 1 */}
        <div className="premium-stat-card">
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', padding: '16px', borderRadius: '20px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}><Users color="#4f46e5" size={28} /></div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>总注册用户</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{totalUsers}</div>
            </div>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="premium-stat-card">
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', padding: '16px', borderRadius: '20px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}><FileSpreadsheet color="#10b981" size={28} /></div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>总处理文件数</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{totalTasks}</div>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="premium-stat-card">
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(217, 119, 6, 0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', padding: '16px', borderRadius: '20px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}><DollarSign color="#d97706" size={28} /></div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>总消耗金额 (Tokens)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{totalRevenue.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="premium-stat-card">
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', padding: '16px', borderRadius: '20px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}><Activity color="#ef4444" size={28} /></div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>系统状态</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>健康运行中</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="premium-stat-card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="var(--primary)" />
          最近处理任务监控
        </h2>
        <div style={{ padding: '40px', background: 'var(--background)', borderRadius: '16px', textAlign: 'center', border: '1px dashed var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>任务日志可视化模块将在后续迭代中展示所有实时处理记录。</p>
        </div>
      </div>
    </div>
  );
}
