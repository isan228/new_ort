import { Navigate } from 'react-router-dom';

export default function Errors() {
  return <Navigate to="/app/create?filter=incorrect" replace />;
}
