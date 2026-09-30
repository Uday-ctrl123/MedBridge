import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingScreen } from '../ui/LoadingScreen'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}
