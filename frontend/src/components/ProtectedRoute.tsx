import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem('recruiterToken');

  if (!token) {
    // Redirect to login page if not authenticated
    return <Navigate to="/recruiter/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
