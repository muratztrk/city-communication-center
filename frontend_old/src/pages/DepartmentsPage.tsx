import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Department } from '../types';
import { getDepartmentTypeLabel } from '../utils/localization';

export function DepartmentsPage() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('Müdürlük');

  const loadDepartments = () => {
    setLoading(true);
    setError(null);
    api.getDepartments()
      .then(setDepartments)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getDepartments()
      .then(setDepartments)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
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

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏢 {t('departments.title')}</h1>
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('common.cancel') : t('departments.new')}
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={handleCreate}>
          <div className="form-group">
            <label>{t('departments.name')}</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('departments.namePlaceholder')}
              required
            />
          </div>
          <div className="form-group">
            <label>{t('departments.type')}</label>
            <select value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="Müdürlük">{getDepartmentTypeLabel(t, 'Müdürlük')}</option>
              <option value="Birim">{getDepartmentTypeLabel(t, 'Birim')}</option>
              <option value="Daire">{getDepartmentTypeLabel(t, 'Daire')}</option>
            </select>
          </div>
          <button type="submit" className="btn primary">{t('common.create')}</button>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('departments.name')}</th>
              <th>{t('departments.type')}</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => (
              <tr key={dept.departmentId}>
                <td>{dept.name}</td>
                <td><span className="badge">{getDepartmentTypeLabel(t, dept.departmentType)}</span></td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr><td colSpan={2} className="text-center">{t('departments.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
