import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { AutocompleteField } from '../components/AutocompleteField';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { Department, DirectoryUserLookup, User, UserManagementContext } from '../types';
import { getRoleLabel, getUserSourceLabel } from '../utils/localization';

type CreateMode = 'manual' | 'ldap';

const DEFAULT_USER_FORM = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  departmentId: '',
  roleCode: 'Staff',
  isActive: true,
  externalIdentityId: null as string | null,
};

function readCreateMode(value: string | null, capabilities: UserManagementContext | null): CreateMode {
  if (value === 'ldap' && capabilities?.ldapEnabled) {
    return 'ldap';
  }

  if (capabilities && !capabilities.localUsersEnabled && capabilities.ldapEnabled) {
    return 'ldap';
  }

  return 'manual';
}

function resolveDataRequests(canManageUsers: boolean) {
  return Promise.all([
    api.getUsers(),
    api.getDepartments(),
    canManageUsers ? api.getUserManagementContext() : Promise.resolve<UserManagementContext | null>(null),
  ] as const);
}

export function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managementContext, setManagementContext] = useState<UserManagementContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState(DEFAULT_USER_FORM);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserLookup[]>([]);
  const [selectedDirectoryUser, setSelectedDirectoryUser] = useState<DirectoryUserLookup | null>(null);

  const canManageUsers = currentUser?.role === 'SystemAdmin';
  const showForm = searchParams.get('create') === '1';
  const createMode = readCreateMode(searchParams.get('mode'), managementContext);
  const debouncedDirectoryQuery = useDebouncedValue(directoryQuery);
  const shouldSearchDirectory = showForm
    && createMode === 'ldap'
    && !!managementContext?.ldapEnabled
    && debouncedDirectoryQuery.trim().length >= 2;

  const loadData = () => {
    setLoading(true);
    setError(null);
    void resolveDataRequests(canManageUsers)
      .then(([loadedUsers, loadedDepartments, capabilities]) => {
        setUsers(loadedUsers);
        setDepartments(loadedDepartments);
        setManagementContext(capabilities);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let isActive = true;

    void resolveDataRequests(canManageUsers)
      .then(([loadedUsers, loadedDepartments, capabilities]) => {
        if (!isActive) {
          return;
        }

        setUsers(loadedUsers);
        setDepartments(loadedDepartments);
        setManagementContext(capabilities);
      })
      .catch(fetchError => {
        if (isActive) {
          setError((fetchError as Error).message);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canManageUsers]);

  useEffect(() => {
    if (!shouldSearchDirectory) {
      return;
    }

    let isActive = true;

    void api.searchDirectoryUsers(debouncedDirectoryQuery.trim())
      .then(results => {
        if (isActive) {
          setDirectoryResults(results);
        }
      })
      .catch(searchError => {
        if (isActive) {
          setError((searchError as Error).message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [debouncedDirectoryQuery, shouldSearchDirectory]);

  useEffect(() => {
    if (!managementContext || !showForm) {
      return;
    }

    const nextMode = readCreateMode(searchParams.get('mode'), managementContext);
    if (nextMode !== searchParams.get('mode')) {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('mode', nextMode);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [managementContext, searchParams, setSearchParams, showForm]);

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

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, value);
      }
    });

    setSearchParams(nextSearchParams, { replace: true });
  };

  const resetForm = () => {
    setNewUser(DEFAULT_USER_FORM);
    setDirectoryQuery('');
    setDirectoryResults([]);
    setSelectedDirectoryUser(null);
  };

  const closeCreateForm = () => {
    resetForm();
    updateSearchParams({ create: null, mode: null });
  };

  const openCreateForm = () => {
    const initialMode = managementContext?.localUsersEnabled === false && managementContext?.ldapEnabled ? 'ldap' : 'manual';
    updateSearchParams({ create: '1', mode: initialMode });
  };

  const switchCreateMode = (nextMode: CreateMode) => {
    resetForm();
    updateSearchParams({ create: '1', mode: nextMode });
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await api.createUser({
        username: createMode === 'ldap' ? newUser.username || null : newUser.username.trim() || null,
        displayName: newUser.displayName,
        email: newUser.email || null,
        password: createMode === 'manual' ? newUser.password : null,
        departmentId: newUser.departmentId,
        roleCode: newUser.roleCode,
        isActive: newUser.isActive,
        sourceType: createMode === 'ldap' ? 'Ldap' : 'Manual',
        externalIdentityId: createMode === 'ldap' ? newUser.externalIdentityId : null,
      });

      closeCreateForm();
      loadData();
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  const directoryOptions = directoryResults.map(result => ({
    id: result.externalIdentityId,
    label: result.displayName,
    description: [result.username, result.email].filter(Boolean).join(' • '),
    helperText: result.alreadyLinked ? t('users.alreadyLinked') : undefined,
    badgeText: result.alreadyLinked ? t('users.alreadyLinkedBadge') : 'LDAP',
    disabled: result.alreadyLinked,
  }));

  const ldapModeReady = createMode !== 'ldap' || !!newUser.externalIdentityId;

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>👥 {t('users.title')}</h1>
        {canManageUsers && (
          <button className="btn primary" onClick={showForm ? closeCreateForm : openCreateForm}>
            {showForm ? t('common.cancel') : t('users.new')}
          </button>
        )}
      </div>

      {canManageUsers && showForm && (
        <form className="form-card" onSubmit={handleCreateUser}>
          <div className="form-group">
            <label>{t('users.createMode')}</label>
            <div className="segmented-control">
              {managementContext?.localUsersEnabled !== false ? (
                <button className={createMode === 'manual' ? 'active' : ''} onClick={() => switchCreateMode('manual')} type="button">
                  {t('users.manualMode')}
                </button>
              ) : null}
              {managementContext?.ldapEnabled ? (
                <button className={createMode === 'ldap' ? 'active' : ''} onClick={() => switchCreateMode('ldap')} type="button">
                  {t('users.ldapMode')}
                </button>
              ) : null}
            </div>
            <p className="helper-text">{createMode === 'ldap' ? t('users.sourceLdapHint') : t('users.sourceManualHint')}</p>
          </div>

          {createMode === 'ldap' ? (
            <div className="surface-card" style={{ marginBottom: '1rem' }}>
              <h2>{t('users.directorySearch')}</h2>
              <AutocompleteField
                ariaLabel={t('users.directorySearchAria')}
                emptyMessage={t('users.directorySearchEmpty')}
                loadingMessage={t('users.directorySearchLoading')}
                options={directoryOptions}
                placeholder={t('users.directorySearchPlaceholder')}
                value={directoryQuery}
                onOptionSelect={option => {
                  const selected = directoryResults.find(result => result.externalIdentityId === option.id) ?? null;
                  setSelectedDirectoryUser(selected);
                  setDirectoryQuery(option.label);
                  setNewUser(current => ({
                    ...current,
                    username: selected?.username ?? current.username,
                    displayName: selected?.displayName ?? current.displayName,
                    email: selected?.email ?? current.email,
                    password: '',
                    externalIdentityId: selected?.externalIdentityId ?? null,
                  }));
                }}
                onValueChange={value => {
                  setDirectoryQuery(value);
                  if (value.trim().length < 2) {
                    setDirectoryResults([]);
                  }
                  if (!value.trim()) {
                    setSelectedDirectoryUser(null);
                    setNewUser(current => ({ ...current, username: '', displayName: '', email: '', externalIdentityId: null }));
                  }
                }}
              />
              {selectedDirectoryUser ? (
                <div className="muted-callout">
                  <h4>{selectedDirectoryUser.displayName}</h4>
                  <p>{selectedDirectoryUser.username}{selectedDirectoryUser.email ? ` • ${selectedDirectoryUser.email}` : ''}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="form-row">
            <div className="form-group">
              <label>{t('users.username')}</label>
              <input
                aria-label={t('users.username')}
                disabled={createMode === 'ldap'}
                type="text"
                value={newUser.username}
                onChange={event => setNewUser(current => ({ ...current, username: event.target.value }))}
                placeholder={t('users.usernamePlaceholder')}
                required={createMode === 'manual'}
              />
            </div>
            <div className="form-group">
              <label>{t('users.displayName')}</label>
              <input
                aria-label={t('users.displayName')}
                disabled={createMode === 'ldap'}
                type="text"
                value={newUser.displayName}
                onChange={event => setNewUser(current => ({ ...current, displayName: event.target.value }))}
                placeholder={t('users.displayNamePlaceholder')}
                required={createMode === 'manual'}
              />
            </div>
            <div className="form-group">
              <label>{t('users.email')}</label>
              <input
                aria-label={t('users.email')}
                disabled={createMode === 'ldap'}
                type="email"
                value={newUser.email}
                onChange={event => setNewUser(current => ({ ...current, email: event.target.value }))}
                placeholder={t('users.emailPlaceholder')}
              />
            </div>
          </div>
          <div className="form-row">
            {createMode === 'manual' ? (
              <div className="form-group">
                <label>{t('users.password')}</label>
                <input
                  aria-label={t('users.password')}
                  type="password"
                  value={newUser.password}
                  onChange={event => setNewUser(current => ({ ...current, password: event.target.value }))}
                  placeholder={t('users.passwordPlaceholder')}
                  required
                />
              </div>
            ) : (
              <div className="form-group">
                <label>{t('users.externalIdentity')}</label>
                <input aria-label={t('users.externalIdentity')} disabled value={selectedDirectoryUser?.username ?? t('users.directorySelectionRequired')} />
              </div>
            )}
            <div className="form-group">
              <label>{t('users.department')}</label>
              <select
                aria-label={t('users.department')}
                value={newUser.departmentId}
                onChange={event => setNewUser(current => ({ ...current, departmentId: event.target.value }))}
                required
              >
                <option value="">{t('tasks.selectDepartment')}</option>
                {departments.map(department => (
                  <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('users.role')}</label>
              <select
                aria-label={t('users.role')}
                value={newUser.roleCode}
                onChange={event => setNewUser(current => ({ ...current, roleCode: event.target.value }))}
              >
                {['SystemAdmin', 'Manager', 'Operator', 'Staff', 'Reporter'].map(roleCode => (
                  <option key={roleCode} value={roleCode}>{getRoleLabel(t, roleCode)}</option>
                ))}
              </select>
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={newUser.isActive}
                  onChange={event => setNewUser(current => ({ ...current, isActive: event.target.checked }))}
                />
                {t('users.active')}
              </label>
            </div>
          </div>
          <button disabled={!ldapModeReady} type="submit" className="btn primary">{t('common.create')}</button>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('users.username')}</th>
              <th>{t('users.displayName')}</th>
              <th>{t('users.email')}</th>
              <th>{t('users.department')}</th>
              <th>{t('users.role')}</th>
              <th>{t('users.source')}</th>
              <th>{t('users.status')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.userId}>
                <td>{user.username || '-'}</td>
                <td>{user.displayName}</td>
                <td>{user.email || '-'}</td>
                <td>{getDeptName(user.departmentId)}</td>
                <td><span className={getRoleBadgeClass(user.roleCode)}>{getRoleLabel(t, user.roleCode)}</span></td>
                <td><span className="badge info">{getUserSourceLabel(t, user.userSource)}</span></td>
                <td>
                  <span className={`badge ${user.isActive ? 'success' : 'danger'}`}>
                    {user.isActive ? t('users.active') : t('users.inactive')}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="text-center">{t('users.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
