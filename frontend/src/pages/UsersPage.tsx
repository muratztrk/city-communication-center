import type { FormEvent } from 'react'
import type { TFunction } from 'i18next'
import { Eye, EyeOff, ShieldUser, PenLine, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSortable } from '../hooks/useSortable'
import { ClearPieFilterLink } from '../components/ui/ClearPieFilterLink'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateDepartments, invalidateUsers } from '../api/cacheInvalidation'
import { AutocompleteField } from '../components/forms/AutocompleteField'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { MultiSelectDropdown } from '../components/ui/multi-select-dropdown'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { StatusPill } from '../components/ui/status-pill'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { TablePagination } from '../components/ui/table-pagination'
import { useAuth } from '../context/AuthContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { Department, DirectoryUserLookup, User, UserManagementContext } from '../types/platform'
import { getRoleLabel, getUserSourceLabel } from '../utils/localization'

type CreateMode = 'manual' | 'ldap'

const ADDITIONAL_ROLE_CODES = ['Operator', 'Staff', 'Reporter', 'EDevletActivityPlan', 'CitizenRequestManager'] as const
const MIN_USER_SEARCH_LENGTH = 3
/** UI-only rol seçeneği — kayıtta Manager'a map (card #1897). */
const SORUMLU_ROLE_OPTION = 'Sorumlu'

function resolvePrimaryRoleCode(roleCode: string): string {
  return roleCode === SORUMLU_ROLE_OPTION ? 'Manager' : roleCode
}

function getAllowedAdditionalRoleCodes(primaryRoleCode: string) {
  const resolvedPrimaryRoleCode = resolvePrimaryRoleCode(primaryRoleCode)
  return ADDITIONAL_ROLE_CODES.filter(roleCode =>
    roleCode !== resolvedPrimaryRoleCode
    && !(resolvedPrimaryRoleCode === 'Manager'
      && (roleCode === 'Staff' || roleCode === 'CitizenRequestManager')),
  )
}

/** Kayıtlı Manager + Responsible listesinde (müdür koltuğu değil) → UI Sorumlu (card #1898). */
function resolveUiRoleCode(user: User, departments: Department[]): string {
  if (user.roleCode !== 'Manager') return user.roleCode
  const dept = departments.find(item => item.departmentId === user.departmentId)
  if (!dept) return 'Manager'
  const isResponsible = (dept.responsibleUserIds ?? []).includes(user.userId)
  const isManagerSeat = dept.managerUserId === user.userId
  if (isResponsible && !isManagerSeat) return SORUMLU_ROLE_OPTION
  return 'Manager'
}

function primaryRoleFormOptions(t: TFunction) {
  // Sıra: Standart → Sorumlu → Müdür → Operatör → CRM → Reporter → e-Devlet → SystemAdmin (#r514).
  const ordered: Array<{ value: string; label: string }> = [
    { value: 'Staff', label: getRoleLabel(t, 'Staff') },
    { value: SORUMLU_ROLE_OPTION, label: t('enum.role.Sorumlu', 'Sorumlu') },
    { value: 'Manager', label: getRoleLabel(t, 'Manager') },
    { value: 'Operator', label: getRoleLabel(t, 'Operator') },
    { value: 'CitizenRequestManager', label: getRoleLabel(t, 'CitizenRequestManager') },
    { value: 'Reporter', label: getRoleLabel(t, 'Reporter') },
    { value: 'EDevletActivityPlan', label: getRoleLabel(t, 'EDevletActivityPlan') },
    { value: 'SystemAdmin', label: getRoleLabel(t, 'SystemAdmin') },
  ]
  return ordered
}

const DEFAULT_USER_FORM = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  passwordConfirm: '',
  title: '',
  phone: '',
  departmentId: '',
  additionalDepartmentIds: [] as string[],
  roleCode: 'Staff',
  additionalRoleCodes: [] as string[],
  isActive: true,
  externalIdentityId: null as string | null,
}

function readCreateMode(value: string | null, capabilities: UserManagementContext | null): CreateMode {
  if (value === 'manual' && capabilities?.localUsersEnabled) {
    return 'manual'
  }

  // Varsayılan: LDAP (card #r449).
  if (capabilities?.ldapEnabled) {
    return 'ldap'
  }

  return 'manual'
}

/** LDAP description (Title) içinde "Müdür" geçiyorsa rol Müdür (card #1789). */
function titleImpliesManager(title: string | null | undefined): boolean {
  return (title ?? '').toLocaleLowerCase('tr').includes('müdür')
}

function resolveDataRequests(canManageUsers: boolean) {
  return Promise.all([
    api.getUsers(),
    api.getDepartments(),
    canManageUsers ? api.getUserManagementContext() : Promise.resolve<UserManagementContext | null>(null),
  ] as const)
}

export function UsersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managementContext, setManagementContext] = useState<UserManagementContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState(DEFAULT_USER_FORM)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    title: '',
    email: '',
    departmentId: '',
    additionalDepartmentIds: [] as string[],
    roleCode: '',
    additionalRoleCodes: [] as string[],
    isActive: true,
  })
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryResults, setDirectoryResults] = useState<DirectoryUserLookup[]>([])
  const [selectedDirectoryUser, setSelectedDirectoryUser] = useState<DirectoryUserLookup | null>(null)
  const [directorySyncLoading, setDirectorySyncLoading] = useState(false)
  const [directorySyncMessage, setDirectorySyncMessage] = useState<string | null>(null)
  const [addAllLdapLoading, setAddAllLdapLoading] = useState(false)
  const [deleteAllLdapLoading, setDeleteAllLdapLoading] = useState(false)
  /** LDAP'ta birim alanı boş kullanıcılar — buton sağındaki dropdown (card #1752). */
  const [ldapUsersWithoutDepartment, setLdapUsersWithoutDepartment] = useState<DirectoryUserLookup[]>([])
  const [ldapUsersWithoutDepartmentValue, setLdapUsersWithoutDepartmentValue] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const canManageUsers = currentUser?.role === 'SystemAdmin'
  const showForm = searchParams.get('create') === '1'
  const createMode = readCreateMode(searchParams.get('mode'), managementContext)
  const debouncedDirectoryQuery = useDebouncedValue(directoryQuery)
  const shouldSearchDirectory = showForm
    && createMode === 'ldap'
    && !!managementContext?.ldapEnabled
    && debouncedDirectoryQuery.trim().length >= 3

  const getDepartmentManager = (departmentId: string, excludeUserId?: string): User | undefined => {
    if (!departmentId) return undefined
    const dept = departments.find(item => item.departmentId === departmentId)
    if (dept?.managerUserId && dept.managerUserId !== excludeUserId) {
      return users.find(u => u.userId === dept.managerUserId)
    }
    const responsibleIds = new Set(dept?.responsibleUserIds ?? [])
    // Sorumlu (ResponsibleUserIds) müdür kontenjanına sayılmaz (card #1898).
    return users.find(u =>
      u.departmentId === departmentId
      && u.roleCode === 'Manager'
      && u.userId !== excludeUserId
      && !responsibleIds.has(u.userId))
  }

  const getUserDepartmentIds = (item: User): string[] => {
    const ids = new Set<string>([item.departmentId])
    item.departments?.forEach(department => ids.add(department.departmentId))
    return Array.from(ids)
  }

  const loadData = () => {
    setLoading(true)
    setError('')

    void resolveDataRequests(canManageUsers)
      .then(([loadedUsers, loadedDepartments, capabilities]) => {
        setUsers(loadedUsers)
        setDepartments(loadedDepartments)
        setManagementContext(capabilities)
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('common.error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let isActive = true

    void resolveDataRequests(canManageUsers)
      .then(([loadedUsers, loadedDepartments, capabilities]) => {
        if (!isActive) {
          return
        }

        setUsers(loadedUsers)
        setDepartments(loadedDepartments)
        setManagementContext(capabilities)
      })
      .catch(loadError => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [canManageUsers, t])

  useEffect(() => {
    if (!shouldSearchDirectory) {
      return
    }

    let isActive = true

    void api.searchDirectoryUsers(debouncedDirectoryQuery.trim())
      .then(results => {
        if (isActive) {
          setDirectoryResults(results)
        }
      })
      .catch(searchError => {
        if (isActive) {
          setError(searchError instanceof Error ? searchError.message : t('common.error'))
        }
      })

    return () => {
      isActive = false
    }
  }, [debouncedDirectoryQuery, shouldSearchDirectory, t])

  const localeCompareTr = (left: string, right: string) =>
    left.localeCompare(right, 'tr', { sensitivity: 'base' })

  const sortByOu = (items: DirectoryUserLookup[]) =>
    [...items].sort((left, right) =>
      localeCompareTr(
        (left.organizationalUnit || left.department || left.displayName || '').trim(),
        (right.organizationalUnit || right.department || right.displayName || '').trim(),
      ))

  const sortByDepartmentOrName = (items: DirectoryUserLookup[]) =>
    [...items].sort((left, right) =>
      localeCompareTr(
        (left.department || left.displayName || '').trim(),
        (right.department || right.displayName || '').trim(),
      ))

  type LdapListMetaMode = 'department' | 'ou' | 'none'

  const renderLdapUserList = (title: string, items: DirectoryUserLookup[], metaMode: LdapListMetaMode) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm text-slate-800 [scrollbar-gutter:stable]">
        {items.map(item => (
          <li key={item.externalIdentityId} className="leading-snug">
            <span className="font-semibold text-slate-950">{item.displayName || item.username}</span>
            {metaMode === 'ou' ? (
              <span className="text-slate-500">
                <span className="text-emerald-600">{' — '}</span>
                {item.organizationalUnit?.trim()
                  ? t('users.addAllLdapMissingOu', { ou: item.organizationalUnit.trim() })
                  : t('users.addAllLdapNoOu')}
              </span>
            ) : null}
            {metaMode === 'department' ? (
              <span className="text-slate-500">
                <span className="text-emerald-600">{' — '}</span>
                {item.department?.trim() || t('users.addAllLdapNoDepartment')}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )

  const renderLdapUserLists = (...sections: Array<{ title: string; items: DirectoryUserLookup[]; metaMode: LdapListMetaMode } | null>) => {
    const visible = sections.filter((section): section is { title: string; items: DirectoryUserLookup[]; metaMode: LdapListMetaMode } =>
      !!section && section.items.length > 0)
    if (visible.length === 0) {
      return undefined
    }
    return (
      <div className="space-y-3">
        {visible.map(section => (
          <div key={section.title}>
            {renderLdapUserList(section.title, section.items, section.metaMode)}
          </div>
        ))}
      </div>
    )
  }

  const handleLiveLdapUserSync = async () => {
    if (!managementContext?.ldapEnabled) {
      return
    }

    setDirectorySyncLoading(true)
    setDirectorySyncMessage(t('users.liveLdapSyncWorking'))
    setError('')

    try {
      // Bağlı LDAP kullanıcılarının username/ad/ünvan/dahili/e-posta alanlarını güncelle (card #1787).
      const syncResult = await api.syncDirectoryUsers()
      const results = await api.listDirectoryUsers()
      setDirectoryResults(results)
      const withoutLdapDepartment = results.filter(item => !item.department?.trim())
      setLdapUsersWithoutDepartment(withoutLdapDepartment)
      setLdapUsersWithoutDepartmentValue('')
      setDirectorySyncMessage(null)
      invalidateUsers(queryClient)
      loadData()

      const newUsers = sortByDepartmentOrName(results.filter(item => !item.alreadyLinked))
      const updatedUsers = syncResult.updatedUsers ?? []
      const fieldLabel = (field: string) => {
        switch (field) {
          case 'Username': return t('users.columns.username', 'Kullanıcı Adı')
          case 'DisplayName': return t('users.columns.displayName', 'Ad Soyad')
          case 'Email': return t('users.columns.email', 'E-posta')
          case 'Title': return t('users.columns.title', 'Ünvan')
          case 'Phone': return t('users.columns.phone', 'Dahili')
          case 'Department': return t('users.columns.department', 'Birim')
          case 'Role': return t('users.columns.role', 'Rol')
          default: return field
        }
      }
      setConfirmDialog({
        title: t('users.liveLdapSync'),
        titleDivider: true,
        titleCompact: true,
        titleTone: 'success',
        // Tek satır özet — message ile details'ta mükerrer sayım yok (card #1815).
        message: syncResult.updatedCount > 0
          ? t('users.liveLdapSyncUpdated', { count: syncResult.updatedCount })
          : (syncResult.message || t('users.liveLdapSyncDone')),
        details: (
          <>
            {updatedUsers.length > 0 ? (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('users.liveLdapSyncUpdatedProfiles', 'Güncellenen profiller')}
                </p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm text-slate-800 [scrollbar-gutter:stable]">
                  {updatedUsers.map(user => (
                    <li key={user.userId} className="leading-snug">
                      <span className="font-semibold text-slate-950">{user.displayName}</span>
                      <ul className="mt-1 space-y-0.5 pl-3 text-xs text-slate-600">
                        {user.changes.map((change, idx) => (
                          <li key={`${user.userId}-${change.field}-${idx}`}>
                            <span className="font-medium text-slate-700">{fieldLabel(change.field)}</span>
                            {': '}
                            <span className="text-slate-500">{change.oldValue?.trim() || '—'}</span>
                            <span className="mx-1 text-emerald-600">→</span>
                            <span className="font-medium text-slate-800">{change.newValue?.trim() || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {newUsers.length > 0
              ? renderLdapUserList(
                  t('users.addAllLdapNewlyPulledTitle', { count: newUsers.length }),
                  newUsers,
                  'department',
                )
              : (
                  <p className="text-sm font-medium text-slate-700">{t('users.liveLdapSyncNoNew')}</p>
                )}
          </>
        ),
        confirmLabel: t('common.exit', 'Çıkış'),
        hideCancel: true,
        variant: 'destructive',
        onConfirm: () => {},
      })
    } catch (syncError) {
      setDirectorySyncMessage(null)
      setError(syncError instanceof Error ? syncError.message : t('common.error'))
    } finally {
      setDirectorySyncLoading(false)
    }
  }

  const handleAddAllLdapUsersClick = async () => {
    if (!managementContext?.ldapEnabled || addAllLdapLoading) {
      return
    }

    setAddAllLdapLoading(true)
    setError('')
    setDirectorySyncMessage(null)

    try {
      // Yalnızca aktif LDAP kullanıcıları (BE filter); ekleme ConfirmDialog Ekle ile (cards #1750/#1757).
      const results = await api.listDirectoryUsers()
      const withoutLdapDepartment = results.filter(item => !item.department?.trim())
      setLdapUsersWithoutDepartment(withoutLdapDepartment)
      setLdapUsersWithoutDepartmentValue('')

      // alreadyLinked: externalId veya sAMAccountName (card #1758).
      const candidates = results.filter(item => !item.alreadyLinked)
      const departmentByKey = new Map(
        departments.map(item => [item.name.trim().toLocaleLowerCase('tr'), item.departmentId] as const),
      )

      // PDO/department dolu → eklenebilir (sistemde yoksa ldapDepartmentName — card #1763).
      // PDO boş → birimi eksik; listede OU (cards #1764/#1765).
      const addable = sortByDepartmentOrName(candidates.filter(item => !!item.department?.trim()))
      const missingDeptUsers = sortByOu(candidates.filter(item => !item.department?.trim()))

      if (candidates.length === 0) {
        setDirectorySyncMessage(t('users.addAllLdapNone'))
        return
      }

      const runBulkAdd = async () => {
        setAddAllLdapLoading(true)
        setError('')
        const createdUsers: DirectoryUserLookup[] = []
        const failedMessages: string[] = []
        try {
          for (const item of addable) {
            const deptName = item.department!.trim()
            const departmentId = departmentByKey.get(deptName.toLocaleLowerCase('tr')) ?? null
            const email = item.email?.trim() || null

            try {
              await api.createUser({
                username: item.username || null,
                displayName: item.displayName || item.username || 'LDAP Kullanıcı',
                email,
                password: null,
                departmentId,
                additionalDepartmentIds: [],
                // Toplu eklemede her zaman Staff gönder; Müdür ünvanını BE kontenjanla yükseltir (card #1824).
                roleCode: 'Staff',
                additionalRoleCodes: [],
                isActive: true,
                sourceType: 'Ldap',
                externalIdentityId: item.externalIdentityId,
                ldapDepartmentName: departmentId ? null : deptName,
                title: item.title?.trim() || null,
                phone: item.phone?.trim() || null,
              })
              createdUsers.push(item)
            } catch (createError) {
              const message = createError instanceof Error ? createError.message : t('common.error')
              failedMessages.push(`${item.displayName || item.username}: ${message}`)
            }
          }

          invalidateUsers(queryClient)
          loadData()

          if (createdUsers.length === 0) {
            setError(failedMessages[0] ?? t('common.error'))
            setConfirmDialog({
              title: t('users.addAllLdap'),
              titleDivider: true,
              titleCompact: true,
              titleTone: 'danger',
              message: failedMessages[0] ?? t('common.error'),
              details: failedMessages.length > 1
                ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {failedMessages.slice(0, 8).map(line => <li key={line}>{line}</li>)}
                    </ul>
                  )
                : undefined,
              confirmLabel: t('common.exit', 'Çıkış'),
              hideCancel: true,
              variant: 'destructive',
              onConfirm: () => {},
            })
            return
          }

          setDirectorySyncMessage(
            missingDeptUsers.length === 0 && failedMessages.length === 0
              ? t('users.addAllLdapAllSuccess')
              : t('users.addAllLdapSuccess', { count: createdUsers.length }),
          )

          setConfirmDialog({
            title: t('users.addAllLdap'),
            titleDivider: true,
            titleCompact: true,
            titleTone: failedMessages.length > 0 ? 'danger' : 'success',
            message:
              missingDeptUsers.length === 0 && failedMessages.length === 0
                ? t('users.addAllLdapAllSuccess')
                : t('users.addAllLdapSuccess', { count: createdUsers.length }),
            details: (
              <>
                {createdUsers.length > 0
                  ? renderLdapUserList(
                      t('users.addAllLdapNewlyPulledTitle', { count: createdUsers.length }),
                      sortByDepartmentOrName(createdUsers),
                      'none',
                    )
                  : null}
                {failedMessages.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-600">
                    {failedMessages.slice(0, 8).map(line => <li key={line}>{line}</li>)}
                  </ul>
                ) : null}
              </>
            ),
            confirmLabel: t('common.exit', 'Çıkış'),
            hideCancel: true,
            variant: 'destructive',
            onConfirm: () => {},
          })
        } finally {
          setAddAllLdapLoading(false)
        }
      }

      if (addable.length === 0) {
        setConfirmDialog({
          title: t('users.addAllLdap'),
          titleDivider: true,
          titleCompact: true,
          titleTone: 'danger',
          message: t('users.addAllLdapDepartmentsRequired'),
          details: renderLdapUserLists({
            title: t('users.addAllLdapMissingUsersTitle', { count: missingDeptUsers.length }),
            items: missingDeptUsers,
            metaMode: 'ou',
          }),
          confirmLabel: t('common.exit', 'Çıkış'),
          hideCancel: true,
          variant: 'destructive',
          onConfirm: () => {},
        })
        return
      }

      setConfirmDialog({
        title: t('users.addAllLdap'),
        titleDivider: true,
        titleCompact: true,
        titleTone: missingDeptUsers.length > 0 ? 'danger' : undefined,
        message:
          missingDeptUsers.length > 0
            ? t('users.addAllLdapDepartmentsRequired')
            : t('users.addAllLdapConfirm', { count: addable.length }),
        details: missingDeptUsers.length > 0
          ? renderLdapUserLists(
              {
                title: t('users.addAllLdapMissingUsersTitle', { count: missingDeptUsers.length }),
                items: missingDeptUsers,
                metaMode: 'ou',
              },
              {
                title: t('users.addAllLdapWillAddTitle', { count: addable.length }),
                items: addable,
                metaMode: 'department',
              },
            )
          : undefined,
        confirmLabel: t('common.add', 'Ekle'),
        cancelLabel: t('common.exit', 'Çıkış'),
        cancelVariant: 'destructive',
        variant: 'primary',
        onConfirm: () => void runBulkAdd(),
      })
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : t('common.error'))
    } finally {
      setAddAllLdapLoading(false)
    }
  }

  const handleDeleteAllLdapUsersClick = () => {
    if (!managementContext?.ldapEnabled || deleteAllLdapLoading) {
      return
    }

    setConfirmDialog({
      title: t('users.deleteAllLdap'),
      titleDivider: true,
      titleCompact: true,
      titleTone: 'danger',
      message: t('users.deleteAllLdapConfirm'),
      confirmLabel: t('common.delete', 'Sil'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          setDeleteAllLdapLoading(true)
          setError('')
          try {
            const result = await api.deleteUnusedLdapUsers()
            invalidateUsers(queryClient)
            loadData()
            setDirectorySyncMessage(
              result.deletedCount > 0
                ? t('users.deleteAllLdapSuccess', { count: result.deletedCount })
                : t('users.deleteAllLdapNone'),
            )
            setConfirmDialog({
              title: t('users.deleteAllLdap'),
              titleDivider: true,
              titleCompact: true,
              titleTone: result.deletedCount > 0 ? 'success' : 'danger',
              message: result.deletedCount > 0
                ? t('users.deleteAllLdapSuccess', { count: result.deletedCount })
                : t('users.deleteAllLdapNone'),
              confirmLabel: t('common.exit', 'Çıkış'),
              hideCancel: true,
              variant: 'destructive',
              onConfirm: () => {},
            })
          } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
          } finally {
            setDeleteAllLdapLoading(false)
          }
        })()
      },
    })
  }

  useEffect(() => {
    if (!managementContext || !showForm) {
      return
    }

    const nextMode = readCreateMode(searchParams.get('mode'), managementContext)
    if (nextMode !== searchParams.get('mode')) {
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('mode', nextMode)
      setSearchParams(nextSearchParams, { replace: true })
    }
  }, [managementContext, searchParams, setSearchParams, showForm])

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const nextSearchParams = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        nextSearchParams.delete(key)
      } else {
        nextSearchParams.set(key, value)
      }
    })

    setSearchParams(nextSearchParams, { replace: true })
  }

  const resetForm = () => {
    setNewUser(DEFAULT_USER_FORM)
    setShowNewPassword(false)
    setShowNewPasswordConfirm(false)
    setDirectoryQuery('')
    setDirectoryResults([])
    setSelectedDirectoryUser(null)
  }

  const closeCreateForm = () => {
    resetForm()
    setUserSearchText('')
    updateSearchParams({ create: null, mode: null })
  }

  const openCreateForm = () => {
    // Yarım kalan satır düzenlemesini kapat (card #r457).
    setEditingUserId(null)
    setUserSearchText('')
    const initialMode = managementContext?.ldapEnabled ? 'ldap' : 'manual'
    updateSearchParams({ create: '1', mode: initialMode })
  }

  const switchCreateMode = (nextMode: CreateMode) => {
    resetForm()
    updateSearchParams({ create: '1', mode: nextMode })
  }

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (createMode === 'manual' && newUser.password !== newUser.passwordConfirm) {
      setError(t('users.passwordMismatch'))
      return
    }

    const resolvedRoleCode = resolvePrimaryRoleCode(newUser.roleCode)
    if (newUser.roleCode === 'Manager' && newUser.departmentId) {
      const existingManager = getDepartmentManager(newUser.departmentId)
      if (existingManager) {
        setError(t('users.managerConflict', { name: existingManager.displayName }))
        return
      }
    }

    try {
      await api.createUser({
        username: createMode === 'ldap' ? newUser.username || null : newUser.username.trim() || null,
        displayName: newUser.displayName,
        email: newUser.email || null,
        password: createMode === 'manual' ? newUser.password : null,
        departmentId: newUser.departmentId || null,
        additionalDepartmentIds: newUser.additionalDepartmentIds.filter(id => id !== newUser.departmentId),
        roleCode: resolvedRoleCode,
        additionalRoleCodes: newUser.additionalRoleCodes.filter(role => role !== resolvedRoleCode),
        isActive: newUser.isActive,
        skipManagerQuota: newUser.roleCode === SORUMLU_ROLE_OPTION,
        sourceType: createMode === 'ldap' ? 'Ldap' : 'Manual',
        externalIdentityId: createMode === 'ldap' ? newUser.externalIdentityId : null,
        ldapDepartmentName: createMode === 'ldap' ? selectedDirectoryUser?.department ?? null : null,
        title: newUser.title.trim() || null,
        phone: newUser.phone.trim() || null,
      })

      // Oluşturunca form kapanıp listeye dönmesin — alanlar temizlenip form açık kalsın (card #2258).
      resetForm()
      invalidateUsers(queryClient)
      invalidateDepartments(queryClient)
      loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('common.error'))
    }
  }

  const startEditing = (user: User) => {
    // Yeni Kullanıcı formu açıksa kapat; başka satırın yarım düzenlemesi de değişir (#r457).
    if (showForm) {
      resetForm()
      updateSearchParams({ create: null, mode: null })
    }
    const uiRoleCode = resolveUiRoleCode(user, departments)
    setEditingUserId(user.userId)
    setEditForm({
      username: user.username ?? '',
      displayName: user.displayName ?? '',
      title: user.title ?? '',
      email: user.email ?? '',
      departmentId: user.departmentId,
      additionalDepartmentIds: getUserDepartmentIds(user).filter(id => id !== user.departmentId),
      roleCode: uiRoleCode,
      additionalRoleCodes: (user.additionalRoleCodes ?? []).filter(role =>
        getAllowedAdditionalRoleCodes(uiRoleCode).includes(role as typeof ADDITIONAL_ROLE_CODES[number])),
      isActive: user.isActive,
    })
  }

  const cancelEditing = () => {
    setEditingUserId(null)
  }

  const handleUpdateUser = async (userId: string, userSource: string) => {
    setError('')

    const isManual = userSource === 'Manual'
    if (isManual && !editForm.username.trim()) {
      setError(t('users.usernameRequired', 'Kullanıcı adı zorunludur.'))
      return
    }
    if (isManual && !editForm.displayName.trim()) {
      setError(t('users.displayNameRequired', 'Ad soyad zorunludur.'))
      return
    }

    const resolvedRoleCode = resolvePrimaryRoleCode(editForm.roleCode)
    if (editForm.roleCode === 'Manager' && editForm.departmentId) {
      const existingManager = getDepartmentManager(editForm.departmentId, userId)
      if (existingManager) {
        setError(t('users.managerConflict', { name: existingManager.displayName }))
        return
      }
    }

    try {
      await api.updateUser(userId, {
        departmentId: editForm.departmentId,
        additionalDepartmentIds: editForm.additionalDepartmentIds,
        roleCode: resolvedRoleCode,
        additionalRoleCodes: editForm.additionalRoleCodes.filter(role => role !== resolvedRoleCode),
        isActive: editForm.isActive,
        skipManagerQuota: editForm.roleCode === SORUMLU_ROLE_OPTION,
        ...(isManual ? {
          username: editForm.username.trim(),
          displayName: editForm.displayName.trim(),
          email: editForm.email.trim() || null,
          title: editForm.title.trim() || null,
        } : {}),
      })
      setEditingUserId(null)
      invalidateUsers(queryClient)
      invalidateDepartments(queryClient)
      loadData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('common.error'))
    }
  }

  const handleDeleteUser = (user: User) => {
    // Sil onayına geçerken açık düzenleme satırını bırakma (card #r457).
    setEditingUserId(null)
    if (showForm) {
      resetForm()
      updateSearchParams({ create: null, mode: null })
    }
    setConfirmDialog({
      message: t('users.deleteConfirm', { name: user.displayName }),
      variant: 'destructive',
      onConfirm: async () => {
        setError('')
        try {
          await api.deleteUser(user.userId)
          invalidateUsers(queryClient)
          loadData()
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : t('common.error'))
        }
      },
    })
  }

  const directoryOptions = useMemo(() => directoryResults.map(result => ({
    id: result.externalIdentityId,
    label: result.displayName,
    description: [result.username, result.email, result.department].filter(Boolean).join(' • '),
    helperText: result.alreadyLinked ? t('users.alreadyLinked') : undefined,
    badgeText: result.alreadyLinked ? t('users.alreadyLinkedBadge') : 'LDAP',
    disabled: result.alreadyLinked,
  })), [directoryResults, t])

  const ldapModeReady = createMode !== 'ldap' || !!newUser.externalIdentityId
  const getDepartmentName = (departmentId: string) => departments.find(department => department.departmentId === departmentId)?.name || t('common.none')
  const { sortKey: usersSortKey, sortDir: usersSortDir, toggleSort: toggleUsersSort, sortItems: sortUsers } = useSortable()
  const sortedUsers = useMemo(() => sortUsers(users), [users, sortUsers])
  const { filters: userFilters, setFilter: setUserFilter, clearFilters: clearUserFilters, matchesFilters: userMatchesFilters, hasActiveFilters: hasActiveUserColumnFilters } = useColumnFilters()
  const [userSearchText, setUserSearchText] = useState('')
  const columnFilteredUsers = useMemo(() => {
    const trimmedSearch = userSearchText.trim()
    const searchNormalized = trimmedSearch.length >= MIN_USER_SEARCH_LENGTH
      ? trimmedSearch.toLocaleLowerCase('tr')
      : ''
    return sortedUsers.filter(user => {
      if (searchNormalized) {
        const haystack = [
          user.username,
          user.displayName,
        ].map(part => String(part ?? '')).join(' ').toLocaleLowerCase('tr')
        if (!haystack.includes(searchNormalized)) return false
      }
      return userMatchesFilters(user, (key, item) => {
        if (key === 'departmentId') {
          return departments.find(d => d.departmentId === item.departmentId)?.name ?? ''
        }
        if (key === 'roleCode') {
          return getRoleLabel(t, resolveUiRoleCode(item, departments))
        }
        if (key === 'isActive') {
          return item.isActive ? t('common.active', 'Aktif') : t('common.inactive', 'Pasif')
        }
        if (key === 'userSource') {
          return getUserSourceLabel(t, item.userSource)
        }
        return String((item as unknown as Record<string, unknown>)[key] ?? '')
      })
    })
  }, [sortedUsers, userMatchesFilters, userSearchText, departments, t])
  const [usersPageSize, setUsersPageSize] = useState(25)
  const [usersPage, setUsersPage] = useState(1)
  const usersTotalCount = columnFilteredUsers.length
  const usersTotalPages = Math.max(1, Math.ceil(usersTotalCount / usersPageSize) || 1)
  const usersSafePage = Math.min(usersPage, usersTotalPages)
  const pagedUsers = useMemo(() => {
    const start = (usersSafePage - 1) * usersPageSize
    return columnFilteredUsers.slice(start, start + usersPageSize)
  }, [usersSafePage, usersPageSize, columnFilteredUsers])
  const handleUserFilter = (key: string, value: string) => {
    setUserFilter(key, value)
    setUsersPage(1)
  }

  useEffect(() => {
    setUsersPage(1)
  }, [userSearchText])
  const handleUsersSort = (key: string) => {
    toggleUsersSort(key)
    setUsersPage(1)
  }
  const handleUsersPageSizeChange = (size: number) => {
    setUsersPageSize(size)
    setUsersPage(1)
  }
  const summary = {
    total: users.length,
    active: users.filter(user => user.isActive).length,
    local: users.filter(user => user.userSource === 'Manual').length,
    ldap: users.filter(user => user.userSource === 'Ldap').length,
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className={`page-stack desktop-page-shell admin-surface-page${showForm ? ' shrink-0' : ''}`}>
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <h1 className="page-title">{t('users.title')}</h1>
            <p className="page-subtitle">{t('users.subtitle')}</p>
          </div>
          {canManageUsers ? (
            <Button
              type="button"
              variant={showForm ? 'destructive' : 'primary'}
              onClick={showForm ? closeCreateForm : openCreateForm}
            >
              {/* İptal = Yeni Kullanıcı Ekle genişliği (card #r459). */}
              <span className="inline-grid place-items-center">
                <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">{t('users.new')}</span>
                <span className="col-start-1 row-start-1 whitespace-nowrap">{showForm ? t('common.cancel') : t('users.new')}</span>
              </span>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="metric-grid">
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
              <Users className="size-4.5" />
            </div>
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">{t('users.summary.total')}</div>
              <div className="mt-1.5 text-3xl font-extrabold text-slate-950">{summary.total}</div>
            </div>
          </div>
        </div>
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]">
              <ShieldUser className="size-4.5" />
            </div>
            <div className="inline-actions">
              <StatusPill tone="success">{summary.active} {t('users.summary.active')}</StatusPill>
              <StatusPill>{summary.local} {getUserSourceLabel(t, 'Manual')}</StatusPill>
              <StatusPill tone="info">{summary.ldap} LDAP</StatusPill>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="error">{t('common.error')}: {error}</div> : null}

      {canManageUsers && showForm ? (
        <form className="form-card page-stack shrink-0" onSubmit={handleCreateUser}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('users.newFormTitle')}</h2>
            <p className="helper-copy">{t('users.newFormDescription')}</p>
            {!managementContext?.ldapEnabled ? (
              <p className="helper-copy">{t('users.ldapNotConfiguredHint', "Ldap ayarı yapıldıktan sonra LDAP'tan veri çekilebilir.")}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.createMode')}</span>
              <div className="segmented-control">
                {managementContext?.ldapEnabled ? (
                  <button
                    className={createMode === 'ldap' ? 'active create-mode-ldap-pulse' : ''}
                    onClick={() => switchCreateMode('ldap')}
                    type="button"
                  >
                    {t('users.ldapMode')}
                  </button>
                ) : null}
                {managementContext?.localUsersEnabled !== false ? (
                  <button className={createMode === 'manual' ? 'active' : ''} onClick={() => switchCreateMode('manual')} type="button">
                    {t('users.manualMode')}
                  </button>
                ) : null}
              </div>
            </label>
            <p className="helper-copy">{createMode === 'ldap' ? t('users.sourceLdapHint') : t('users.sourceManualHint')}</p>
            {createMode === 'ldap' ? (
              <p className="helper-copy text-red-600/90">{t('users.deleteAllLdapHint')}</p>
            ) : null}
          </div>

          {createMode === 'ldap' ? (
            <div className="section-card page-stack">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="ldap-section-title text-lg font-extrabold text-slate-950">{t('users.directorySearch')}</h3>
                  <button
                    type="button"
                    className="text-sm font-bold text-[color:var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-60"
                    disabled={directorySyncLoading}
                    onClick={() => void handleLiveLdapUserSync()}
                  >
                    {t('users.liveLdapSync')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-bold text-[color:var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-60"
                    disabled={addAllLdapLoading || directorySyncLoading || deleteAllLdapLoading}
                    onClick={() => void handleAddAllLdapUsersClick()}
                  >
                    {addAllLdapLoading ? t('users.addAllLdapWorking') : t('users.addAllLdap')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-bold text-red-600 underline-offset-2 hover:underline disabled:opacity-60"
                    disabled={addAllLdapLoading || directorySyncLoading || deleteAllLdapLoading}
                    onClick={handleDeleteAllLdapUsersClick}
                  >
                    {deleteAllLdapLoading ? t('users.deleteAllLdapWorking') : t('users.deleteAllLdap')}
                  </button>
                </div>
                {ldapUsersWithoutDepartment.length > 0 ? (
                  <div className="min-w-[16rem] max-w-md flex-1">
                    <SingleSelectDropdown
                      options={ldapUsersWithoutDepartment.map(item => ({
                        value: item.externalIdentityId,
                        label: item.displayName || item.username,
                      }))}
                      value={ldapUsersWithoutDepartmentValue}
                      onChange={setLdapUsersWithoutDepartmentValue}
                      placeholder={t('users.ldapUsersWithoutDepartment')}
                      emptyText={t('users.ldapUsersWithoutDepartmentEmpty')}
                      searchable
                      searchPlaceholder={t('common.search', 'Ara...')}
                    />
                  </div>
                ) : null}
              </div>
              <p className="helper-copy">{t('users.directorySearchDescription')}</p>
              <p className="helper-copy">{t('users.directoryLinkHint')}</p>
              {directorySyncMessage ? <p className="helper-copy">{directorySyncMessage}</p> : null}
              <AutocompleteField
                ariaLabel={t('users.directorySearchAria')}
                emptyMessage={t('users.directorySearchEmpty')}
                loadingMessage={t('users.directorySearchLoading')}
                options={directoryOptions}
                placeholder={t('users.directorySearchPlaceholder')}
                value={directoryQuery}
                onOptionSelect={option => {
                  const selected = directoryResults.find(result => result.externalIdentityId === option.id) ?? null
                  setSelectedDirectoryUser(selected)
                  setDirectoryQuery(option.label)

                  // LDAP seçiminde birim eşleştir; birim yoksa oluşturma — Oluştur + ldapDepartmentName (card #1729).
                  let matchedDepartmentId = ''
                  if (selected?.department) {
                    const normalizedLdap = selected.department.toLocaleLowerCase('tr')
                    const existing = departments.find(d => d.name.toLocaleLowerCase('tr') === normalizedLdap)
                    if (existing) {
                      matchedDepartmentId = existing.departmentId
                    }
                  }

                  setNewUser(current => ({
                    ...current,
                    username: selected?.username ?? current.username,
                    displayName: selected?.displayName ?? current.displayName,
                    // mail attribute yoksa boş bırak; UPN ile doldurma (card #1734).
                    email: selected?.email?.trim() ?? '',
                    password: '',
                    title: selected?.title?.trim() ?? '',
                    phone: selected?.phone?.trim() ?? '',
                    externalIdentityId: selected?.externalIdentityId ?? null,
                    departmentId: matchedDepartmentId || current.departmentId,
                    roleCode: titleImpliesManager(selected?.title) ? 'Manager' : 'Staff',
                  }))
                }}
                onValueChange={value => {
                  setDirectoryQuery(value)
                  if (value.trim().length < 3) {
                    setDirectoryResults([])
                  }
                  if (!value.trim()) {
                    setSelectedDirectoryUser(null)
                    setNewUser(current => ({
                      ...current,
                      username: '',
                      displayName: '',
                      email: '',
                      title: '',
                      phone: '',
                      externalIdentityId: null,
                    }))
                  }
                }}
              />
              {selectedDirectoryUser ? (
                <div className="section-card">
                  <div className="font-semibold text-slate-950">{selectedDirectoryUser.displayName}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {selectedDirectoryUser.username}{selectedDirectoryUser.email ? ` • ${selectedDirectoryUser.email}` : ''}
                  </div>
                  {selectedDirectoryUser.department ? (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)]/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
                      🏢 {selectedDirectoryUser.department}
                      {departments.some(d => d.name.toLocaleLowerCase('tr') === selectedDirectoryUser.department!.toLocaleLowerCase('tr'))
                        ? ' ✓'
                        : ` (${t('users.departmentWillBeCreated')})`}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Kullanıcı Adı / Ad Soyad / Dahili No / Ünvan / E-posta tek satırda (card #1771). */}
          <div className="grid gap-4 lg:grid-cols-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.username')}</span>
              <input
                aria-label={t('users.username')}
                className="field-input"
                disabled={createMode === 'ldap'}
                placeholder={t('users.usernamePlaceholder')}
                type="text"
                value={newUser.username}
                onChange={event => setNewUser(current => ({ ...current, username: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.displayName')}</span>
              <input
                aria-label={t('users.displayName')}
                className="field-input"
                disabled={createMode === 'ldap'}
                placeholder={t('users.displayNamePlaceholder')}
                type="text"
                value={newUser.displayName}
                onChange={event => setNewUser(current => ({ ...current, displayName: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.internalPhone')}</span>
              <input
                aria-label={t('users.internalPhone')}
                className="field-input"
                placeholder={t('users.internalPhonePlaceholder')}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newUser.phone}
                onChange={event => setNewUser(current => ({
                  ...current,
                  // Dahili No: yalnız rakam (card #r449).
                  phone: event.target.value.replace(/\D/g, ''),
                }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.jobTitle')}</span>
              <input
                aria-label={t('users.jobTitle')}
                className="field-input"
                placeholder={t('users.jobTitlePlaceholder')}
                type="text"
                value={newUser.title}
                onChange={event => setNewUser(current => ({
                  ...current,
                  // Ünvan: rakam yok (card #r449).
                  title: event.target.value.replace(/\d/g, ''),
                }))}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('users.email')}</span>
              <input
                aria-label={t('users.email')}
                className="field-input"
                disabled={createMode === 'ldap'}
                placeholder={t('users.emailPlaceholder')}
                type="email"
                value={newUser.email}
                onChange={event => setNewUser(current => ({ ...current, email: event.target.value }))}
              />
            </label>
          </div>

          {createMode === 'manual' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>
                  {t('users.password')}{' '}
                  <span className="text-xs font-normal text-slate-400">{t('users.passwordHint', '(Parola minimum 8 karakter, büyük harf, küçük harf, karakter, rakam içermelidir.)')}</span>
                </span>
                <div className="relative">
                  <input
                    aria-label={t('users.password')}
                    className="field-input pr-10"
                    placeholder={t('users.passwordPlaceholder')}
                    type={showNewPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={event => setNewUser(current => ({ ...current, password: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowNewPassword(value => !value)}
                    aria-label={showNewPassword ? t('login.hidePassword', 'Hide password') : t('login.showPassword', 'Show password')}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </button>
                </div>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('users.passwordConfirm')}</span>
                <div className="relative">
                  <input
                    aria-label={t('users.passwordConfirm')}
                    className="field-input pr-10"
                    placeholder={t('users.passwordConfirmPlaceholder')}
                    type={showNewPasswordConfirm ? 'text' : 'password'}
                    value={newUser.passwordConfirm}
                    onChange={event => setNewUser(current => ({ ...current, passwordConfirm: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowNewPasswordConfirm(value => !value)}
                    aria-label={showNewPasswordConfirm ? t('login.hidePassword', 'Hide password') : t('login.showPassword', 'Show password')}
                    tabIndex={-1}
                  >
                    {showNewPasswordConfirm ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                  </button>
                </div>
                {newUser.passwordConfirm.length > 0 && newUser.password !== newUser.passwordConfirm ? (
                  <span className="text-xs font-semibold text-[color:var(--color-destructive)]">
                    {t('users.passwordMismatch')}
                  </span>
                ) : null}
              </label>
            </div>
          ) : null}

          {/* Birim / Ek birimler / Rol / Ek roller / Aktif / Oluştur TEK satırda.
              Rol dar; Rol+Ek roller menü metni küçük; Oluştur geniş ama alçak (card #1739 5. reopen).
              LDAP Dizin Hesabı alanı kaldırıldı (card #1755). Oluştur altında İptal Et → resetForm (card #1756). */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.55fr)_minmax(0,0.5fr)_auto_minmax(13rem,auto)] lg:items-start">
              <div className="grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('users.department')}</span>
                <SingleSelectDropdown
                  options={[...departments]
                    .map(department => ({
                      value: department.departmentId,
                      label: department.name,
                    }))
                    .sort((a, b) => localeCompareTr(a.label, b.label))}
                  value={newUser.departmentId}
                  onChange={departmentId => setNewUser(current => ({
                    ...current,
                    departmentId,
                    additionalDepartmentIds: current.additionalDepartmentIds.filter(id => id !== departmentId),
                  }))}
                  placeholder={t('tasks.selectDepartment')}
                  emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir birim bulunmuyor.')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                  menuClassName="users-roles-compact-menu users-dept-compact-menu"
                />
              </div>

              <div className="users-additional-departments-field grid gap-2 text-sm font-semibold text-slate-700">
                <span>{t('users.additionalDepartments', 'Ek görev yaptığı birimler')}</span>
                <MultiSelectDropdown
                  options={[...departments]
                    .filter(department => department.departmentId !== newUser.departmentId)
                    .map(department => ({ value: department.departmentId, label: department.name }))
                    .sort((a, b) => localeCompareTr(a.label, b.label))}
                  value={newUser.additionalDepartmentIds}
                  onChange={additionalDepartmentIds => setNewUser(current => ({ ...current, additionalDepartmentIds }))}
                  placeholder={t('users.additionalDepartmentsPlaceholder', 'Ek birim seçiniz...')}
                  emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir ek birim bulunmuyor.')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                  menuClassName="users-dept-compact-menu users-roles-compact-menu"
                />
                <span className="helper-copy">{t('users.additionalDepartmentsHelp', 'Kullanıcı ek olarak birden fazla birimde çalışabilir.')}</span>
              </div>

              <div className="users-role-field grid gap-2 font-semibold text-slate-700">
                <span className="text-sm">{t('users.role')}</span>
                <SingleSelectDropdown
                  className="users-role-dropdown"
                  triggerClassName="text-xs"
                  menuClassName="users-roles-compact-menu"
                  menuWidth={220}
                  options={primaryRoleFormOptions(t)}
                  value={newUser.roleCode}
                  onChange={roleCode => setNewUser(current => ({
                    ...current,
                    roleCode,
                    additionalRoleCodes: current.additionalRoleCodes.filter(role =>
                      getAllowedAdditionalRoleCodes(roleCode).includes(role as typeof ADDITIONAL_ROLE_CODES[number])),
                  }))}
                  placeholder={t('users.role')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                />
              </div>

              <div className="users-additional-roles-field grid gap-2 font-semibold text-slate-700">
                <span>{t('users.additionalRoles', 'Ek roller')}</span>
                <MultiSelectDropdown
                  className="users-additional-roles-dropdown"
                  triggerClassName="text-xs"
                  menuClassName="users-roles-compact-menu"
                  menuWidth={220}
                  options={getAllowedAdditionalRoleCodes(newUser.roleCode)
                    .map(roleCode => ({ value: roleCode, label: getRoleLabel(t, roleCode) }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'tr'))}
                  value={newUser.additionalRoleCodes}
                  onChange={additionalRoleCodes => setNewUser(current => ({ ...current, additionalRoleCodes }))}
                  placeholder={t('users.additionalRolesPlaceholder', 'Ek rol seçin')}
                  emptyText={t('users.additionalRolesEmpty', 'Seçilebilir ek rol bulunmuyor.')}
                  searchable
                  searchPlaceholder={t('common.search', 'Ara...')}
                />
                <span className="helper-copy">{t('users.additionalRolesHelp', 'Kullanıcıya ek olarak birden fazla rol verilebilir.')}</span>
              </div>

              <div className="grid gap-2">
                <span aria-hidden="true" className="hidden text-sm font-semibold lg:block">&nbsp;</span>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={newUser.isActive} type="checkbox" onChange={event => setNewUser(current => ({ ...current, isActive: event.target.checked }))} />
                  {t('users.active')}
                </label>
              </div>

              <div className="grid gap-2">
                <span aria-hidden="true" className="hidden text-sm font-semibold lg:block">&nbsp;</span>
                <div className="inline-actions flex flex-col gap-2">
                  <Button
                    className="users-create-submit w-full min-w-[13rem] px-8 text-base"
                    disabled={!ldapModeReady || (createMode === 'manual' && (!newUser.password || newUser.password !== newUser.passwordConfirm))}
                    type="submit"
                  >
                    {t('common.create')}
                  </Button>
                  {createMode === 'ldap' && selectedDirectoryUser ? (
                    <Button
                      className="w-full min-w-[13rem] px-8 text-base"
                      type="button"
                      variant="destructive"
                      onClick={() => resetForm()}
                    >
                      {t('common.cancelAction', 'İptal Et')}
                    </Button>
                  ) : null}
                </div>
              </div>
          </div>

          {newUser.roleCode === 'Manager' && newUser.departmentId && getDepartmentManager(newUser.departmentId) ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              ⚠ {t('users.managerConflict', { name: getDepartmentManager(newUser.departmentId)!.displayName })}
            </div>
          ) : null}
        </form>
      ) : null}

      <section className={`section-card${showForm ? '' : ' desktop-page-fill'}`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 sm:px-5">
          <ClearPieFilterLink hasColumnFilters={hasActiveUserColumnFilters} onClearColumnFilters={clearUserFilters} />
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={userSearchText}
              onChange={event => setUserSearchText(event.target.value)}
              placeholder={t('users.search', 'İsim veya kullanıcı adı ara…')}
              className="field-input w-full pl-8 text-sm"
            />
          </div>
          {(userSearchText || Object.values(userFilters).some(Boolean)) ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => { setUserSearchText(''); clearUserFilters() }}>
              {t('common.reset', 'Temizle')}
            </Button>
          ) : null}
        </div>
        <div className={`table-wrap${showForm ? '' : ' desktop-panel-scroll'}`}>
          <table className="data-table users-table">
            <thead>
              <tr>
                <th className="w-12 text-center">{t('common.rowNo', 'Sıra')}</th>
                <FilterableTh filterKey="username" filterValue={userFilters['username'] ?? ''} onFilter={handleUserFilter} sortKey="username" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.username')}</FilterableTh>
                <FilterableTh filterKey="displayName" filterValue={userFilters['displayName'] ?? ''} onFilter={handleUserFilter} sortKey="displayName" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.displayName')}</FilterableTh>
                <FilterableTh filterKey="title" filterValue={userFilters['title'] ?? ''} onFilter={handleUserFilter} sortKey="title" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.jobTitle')}</FilterableTh>
                <FilterableTh filterKey="email" filterValue={userFilters['email'] ?? ''} onFilter={handleUserFilter} sortKey="email" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.email')}</FilterableTh>
                <FilterableTh filterKey="departmentId" filterValue={userFilters['departmentId'] ?? ''} onFilter={handleUserFilter}>{t('users.department')}</FilterableTh>
                <FilterableTh filterKey="roleCode" filterValue={userFilters['roleCode'] ?? ''} onFilter={handleUserFilter} sortKey="roleCode" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.role')}</FilterableTh>
                <FilterableTh filterKey="userSource" filterValue={userFilters['userSource'] ?? ''} onFilter={handleUserFilter} sortKey="userSource" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.source')}</FilterableTh>
                <FilterableTh filterKey="isActive" filterValue={userFilters['isActive'] ?? ''} onFilter={handleUserFilter} sortKey="isActive" currentSortKey={usersSortKey} sortDir={usersSortDir} onSort={handleUsersSort}>{t('users.status')}</FilterableTh>
                {canManageUsers ? <th className="actions-column">{t('common.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((user, index) => (
                editingUserId === user.userId ? (
                  <tr key={user.userId} className="users-editing-row bg-slate-50">
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(usersSafePage - 1) * usersPageSize + index + 1}</td>
                    <td>
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input min-w-[9rem] text-sm"
                          value={editForm.username}
                          onChange={e => setEditForm(c => ({ ...c, username: e.target.value }))}
                          aria-label={t('users.username')}
                        />
                      ) : (
                        <span>{user.username || t('common.none')}</span>
                      )}
                    </td>
                    <td>
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input min-w-[10rem] text-sm font-semibold"
                          value={editForm.displayName}
                          onChange={e => setEditForm(c => ({ ...c, displayName: e.target.value }))}
                          aria-label={t('users.displayName')}
                        />
                      ) : (
                        <span className="font-semibold">{user.displayName}</span>
                      )}
                    </td>
                    <td className="max-w-[10rem]">
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input w-full text-sm"
                          value={editForm.title}
                          onChange={e => setEditForm(c => ({ ...c, title: e.target.value }))}
                          aria-label={t('users.jobTitle')}
                        />
                      ) : (
                        <span className="block truncate text-slate-500 text-sm" title={user.title ?? undefined}>{user.title || '-'}</span>
                      )}
                    </td>
                    <td>
                      {user.userSource === 'Manual' ? (
                        <input
                          className="field-input min-w-[12rem] text-sm"
                          type="email"
                          value={editForm.email}
                          onChange={e => setEditForm(c => ({ ...c, email: e.target.value }))}
                          aria-label={t('users.email')}
                        />
                      ) : (
                        <span>{user.email || t('common.none')}</span>
                      )}
                    </td>
                    <td className="users-edit-dept-cell w-[7.5rem] max-w-[7.5rem]">
                      <div className="grid w-full min-w-0 gap-1.5">
                        {user.userSource === 'Ldap' ? (
                          <span
                            className="field-select flex min-h-9 w-full items-center truncate bg-slate-100 px-2 text-sm text-slate-700"
                            title={getDepartmentName(editForm.departmentId)}
                          >
                            {getDepartmentName(editForm.departmentId)}
                          </span>
                        ) : (
                          <SingleSelectDropdown
                            options={[...departments]
                              .map(department => ({
                                value: department.departmentId,
                                label: department.name,
                              }))
                              .sort((a, b) => localeCompareTr(a.label, b.label))}
                            value={editForm.departmentId}
                            onChange={departmentId => setEditForm(c => ({
                              ...c,
                              departmentId,
                              additionalDepartmentIds: c.additionalDepartmentIds.filter(id => id !== departmentId),
                            }))}
                            placeholder={t('tasks.selectDepartment')}
                            emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir birim bulunmuyor.')}
                            searchable
                            searchPlaceholder={t('common.search', 'Ara...')}
                            className="w-full min-w-0 max-w-full"
                            triggerClassName="text-sm !min-h-9 !px-2 !bg-slate-100"
                            menuWidth={264}
                            menuScrollClassName="users-edit-dropdown-menu-scroll"
                            menuPortal={false}
                          />
                        )}
                        <MultiSelectDropdown
                          options={[...departments]
                            .filter(department => department.departmentId !== editForm.departmentId)
                            .map(department => ({ value: department.departmentId, label: department.name }))
                            .sort((a, b) => localeCompareTr(a.label, b.label))}
                          value={editForm.additionalDepartmentIds}
                          onChange={additionalDepartmentIds => setEditForm(c => ({ ...c, additionalDepartmentIds }))}
                          placeholder={t('users.additionalDepartmentsShort', 'Ek birimler')}
                          emptyText={t('users.additionalDepartmentsEmpty', 'Seçilebilir ek birim bulunmuyor.')}
                          className="w-full min-w-0 max-w-full users-edit-additional-dept-trigger"
                          triggerClassName="text-xs !min-h-9 !py-0.5 !px-2 !bg-white"
                          menuClassName="users-edit-dropdown-menu-scroll !max-h-96"
                          menuWidth={264}
                          searchable
                          searchPlaceholder={t('common.search', 'Ara...')}
                          menuPortal={false}
                        />
                      </div>
                    </td>
                    <td className="w-[9rem] max-w-[9rem]">
                      <div className="grid w-full gap-1.5">
                        <SingleSelectDropdown
                          options={primaryRoleFormOptions(t)}
                          value={editForm.roleCode}
                          onChange={roleCode => setEditForm(c => ({
                            ...c,
                            roleCode,
                            additionalRoleCodes: c.additionalRoleCodes.filter(role =>
                              getAllowedAdditionalRoleCodes(roleCode).includes(role as typeof ADDITIONAL_ROLE_CODES[number])),
                          }))}
                          placeholder={t('users.role')}
                          searchable
                          searchPlaceholder={t('common.search', 'Ara...')}
                          className="w-full"
                          triggerClassName="text-xs"
                          // Panel: Rol → LDAP (Kaynak) sonu (~9+5rem, card #r459).
                          menuWidth={224}
                          menuScrollClassName="users-edit-dropdown-menu-scroll"
                          menuPortal={false}
                        />
                        <MultiSelectDropdown
                          options={getAllowedAdditionalRoleCodes(editForm.roleCode)
                            .map(roleCode => ({ value: roleCode, label: getRoleLabel(t, roleCode) }))
                            .sort((a, b) => localeCompareTr(a.label, b.label))}
                          value={editForm.additionalRoleCodes}
                          onChange={additionalRoleCodes => setEditForm(c => ({ ...c, additionalRoleCodes }))}
                          placeholder={t('users.additionalRolesShort', 'Ek roller')}
                          emptyText={t('users.additionalRolesEmpty', 'Seçilebilir ek rol bulunmuyor.')}
                          className="w-full users-edit-additional-roles-trigger"
                          triggerClassName="text-xs !min-h-9 !py-0.5"
                          menuClassName="users-edit-dropdown-menu-scroll !max-h-88"
                          menuWidth={224}
                          menuPortal={false}
                        />
                      </div>
                    </td>
                    <td><StatusPill tone="info">{getUserSourceLabel(t, user.userSource)}</StatusPill></td>
                    <td>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input className="field-checkbox" checked={editForm.isActive} type="checkbox" onChange={e => setEditForm(c => ({ ...c, isActive: e.target.checked }))} />
                        {editForm.isActive ? t('users.active') : t('users.inactive')}
                      </label>
                    </td>
                    <td className="actions-column">
                      <div className="row-actions users-edit-row-actions">
                        <Button size="sm" variant="primary" className="users-edit-row-actions-btn" type="button" onClick={() => handleUpdateUser(user.userId, user.userSource)}>{t('common.save')}</Button>
                        <Button size="sm" variant="secondary" className="users-edit-row-actions-btn" type="button" onClick={cancelEditing}>{t('common.cancel')}</Button>
                        {editForm.roleCode === 'Manager' && editForm.departmentId && getDepartmentManager(editForm.departmentId, user.userId) ? (
                          <span className="text-xs font-medium text-amber-700" title={t('users.managerConflict', { name: getDepartmentManager(editForm.departmentId, user.userId)!.displayName })}>
                            ⚠ {getDepartmentManager(editForm.departmentId, user.userId)!.displayName}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={user.userId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(usersSafePage - 1) * usersPageSize + index + 1}</td>
                    <td>{user.username || t('common.none')}</td>
                    <td className="font-semibold">{user.displayName}</td>
                    <td className="max-w-[10rem]"><span className="block truncate text-slate-500 text-sm" title={user.title ?? undefined}>{user.title || '-'}</span></td>
                    <td>{user.email || t('common.none')}</td>
                    <td>
                      <div className="grid gap-1">
                        <span>{getDepartmentName(user.departmentId)}</span>
                        {getUserDepartmentIds(user).filter(id => id !== user.departmentId).length > 0 ? (
                          <span className="text-xs font-semibold text-slate-500">
                            + {getUserDepartmentIds(user).filter(id => id !== user.departmentId).map(getDepartmentName).join(', ')}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="grid gap-1">
                        <StatusPill tone={user.roleCode === 'SystemAdmin' ? 'danger' : user.roleCode === 'Manager' ? 'warning' : 'info'}>{getRoleLabel(t, resolveUiRoleCode(user, departments))}</StatusPill>
                        {(user.additionalRoleCodes ?? []).map(roleCode => (
                          <StatusPill key={roleCode} tone="neutral">{getRoleLabel(t, roleCode)}</StatusPill>
                        ))}
                      </div>
                    </td>
                    <td><StatusPill tone="info">{getUserSourceLabel(t, user.userSource)}</StatusPill></td>
                    <td>
                      <StatusPill tone={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? t('users.active') : t('users.inactive')}
                      </StatusPill>
                    </td>
                    {canManageUsers ? (
                      <td className="actions-column">
                        <div className="row-actions">
                          <button className="icon-action icon-action--labeled" title={t('common.edit')} aria-label={t('common.edit')} type="button" onClick={() => startEditing(user)}>
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            <span>{t('common.edit')}</span>
                          </button>
                          {user.userId !== currentUser?.userId ? (
                            <button className="icon-action icon-action--labeled danger" title={t('common.delete')} aria-label={t('common.delete')} type="button" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="size-3.5" />
                              <span>{t('common.delete')}</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              ))}
              {pagedUsers.length === 0 ? (
                <TableEmptyStateRows
                  columnCount={canManageUsers ? 10 : 9}
                  message={t('users.empty')}
                />
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={usersTotalCount}
          pageSize={usersPageSize}
          currentPage={usersSafePage}
          onPageSizeChange={handleUsersPageSizeChange}
          onPageChange={setUsersPage}
        />
      </section>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
