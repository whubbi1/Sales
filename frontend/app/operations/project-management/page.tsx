'use client'
import { OperationsLayout } from '@/components/OperationsLayout'
import { OperationsProjectList } from '@/components/operations/OperationsProjectList'

// Access is enforced by OperationsLayout's route gate on the project_management submodule.
export default function ProjectManagementPage() {
  return <OperationsLayout><OperationsProjectList mode="management" /></OperationsLayout>
}
