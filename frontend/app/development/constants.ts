export const API = 'https://api.whubbi.wcomply.com'

export const APPLICATIONS = ['WHUBBI', 'Karanext', 'Payfit', 'SAP', 'SharePoint', 'Microsoft 365', 'Other']

export const PIPELINE_STATUSES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'to_be_planned',  label: 'To Be Planned',  color: '#94A3B8', bg: '#F1F5F9' },
  { value: 'planned',        label: 'Planned',         color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'in_development', label: 'In Development',  color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'under_testing',  label: 'Under Testing',   color: '#8B5CF6', bg: '#F5F3FF' },
  { value: 'in_production',  label: 'In Production',   color: '#10B981', bg: '#ECFDF5' },
  { value: 'closed',         label: 'Closed',          color: '#6B7280', bg: '#F9FAFB' },
]

// Development requests are helpdesk tickets — use helpdesk statuses
export const REQUEST_STATUSES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'new',         label: 'New',         color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'open',        label: 'Open',        color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'in_progress', label: 'In Progress', color: '#8B5CF6', bg: '#F5F3FF' },
  { value: 'pending',     label: 'Pending',     color: '#F97316', bg: '#FFF7ED' },
  { value: 'resolved',    label: 'Resolved',    color: '#10B981', bg: '#ECFDF5' },
  { value: 'closed',      label: 'Closed',      color: '#6B7280', bg: '#F9FAFB' },
]

export const REQUEST_PRIORITIES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'low',      label: 'Low',      color: '#10B981', bg: '#ECFDF5' },
  { value: 'medium',   label: 'Medium',   color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'high',     label: 'High',     color: '#EF4444', bg: '#FEF2F2' },
  { value: 'critical', label: 'Critical', color: '#DC2626', bg: '#FEE2E2' },
]

export const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: 'feature',        label: 'Feature' },
  { value: 'bug',            label: 'Bug Fix' },
  { value: 'enhancement',    label: 'Enhancement' },
  { value: 'change_request', label: 'Change Request' },
]

export const EXECUTION_STATUSES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'not_started', label: 'Not Started', color: '#94A3B8', bg: '#F1F5F9' },
  { value: 'in_progress', label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'passed',      label: 'Passed',      color: '#10B981', bg: '#ECFDF5' },
  { value: 'failed',      label: 'Failed',      color: '#EF4444', bg: '#FEF2F2' },
]

export function getPipelineStatus(value: string) {
  return PIPELINE_STATUSES.find(s => s.value === value) || PIPELINE_STATUSES[0]
}
export function getRequestStatus(value: string) {
  return REQUEST_STATUSES.find(s => s.value === value) || REQUEST_STATUSES[0]
}
export function getRequestPriority(value: string) {
  return REQUEST_PRIORITIES.find(p => p.value === value) || REQUEST_PRIORITIES[1]
}
export function getExecutionStatus(value: string) {
  return EXECUTION_STATUSES.find(s => s.value === value) || EXECUTION_STATUSES[0]
}
