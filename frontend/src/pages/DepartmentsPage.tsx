import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Department } from '../types';

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Müdürlük');

  const loadDepartments = () => {
    setLoading(true);
    api.getDepartments()
      .then(setDepartments)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.createDepartment(newName, newType);
      setNewName('');
      setShowForm(false);
      loadDepartments();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (error) return <div className="error">Hata: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏢 Departmanlar</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'İptal' : '+ Yeni Departman'}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group">
            <label>Departman Adı</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Departman adı girin"
              required
            />
          </div>
          <div className="form-group">
            <label>Tür</label>
            <select value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="Müdürlük">Müdürlük</option>
              <option value="Birim">Birim</option>
              <option value="Daire">Daire Başkanlığı</option>
            </select>
          </div>
          <button type="submit" className="btn primary">Oluştur</button>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Tür</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => (
              <tr key={dept.departmentId}>
                <td>{dept.name}</td>
                <td><span className="badge">{dept.departmentType}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
