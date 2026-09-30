import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingScreen } from '../ui/LoadingScreen'

export function HospitalGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!profile || profile.role !== 'hospital_user') {
    return <Navigate to="/hospital/login" replace />
  }
  return <>{children}</>
}
