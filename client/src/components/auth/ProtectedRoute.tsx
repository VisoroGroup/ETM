import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
    allowedRoles: string[];
    children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: Props) {
    const { user } = useAuth();

    if (!user || !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
