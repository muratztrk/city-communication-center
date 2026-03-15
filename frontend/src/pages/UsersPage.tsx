import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User, Department } from '../types';

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getUsers(), api.getDepartments()])
      .then(([users, depts]) => {
        setUsers(users);
        setDepartments(depts);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const getDeptName = (deptId: string) => {
    return departments.find(d => d.departmentId === deptId)?.name || '-';
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'SystemAdmin': return 'badge danger';
      case 'Manager': return 'badge warning';
      case 'Operator': return 'badge info';
      default: return 'badge';
    }
  };

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (error) return <div className="error">Hata: {error}</div>;

  return (
    <div className="page">
      <h1>👥 Kullanıcılar</h1>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Departman</th>
              <th>Rol</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.userId}>
                <td>{user.displayName}</td>
                <td>{user.email || '-'}</td>
                <td>{getDeptName(user.departmentId)}</td>
                <td><span className={getRoleBadgeClass(user.roleCode)}>{user.roleCode}</span></td>
                <td>
                  <span className={`badge ${user.isActive ? 'success' : 'danger'}`}>
                    {user.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
