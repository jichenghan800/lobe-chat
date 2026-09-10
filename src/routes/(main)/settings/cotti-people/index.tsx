import { Navigate } from 'react-router';

export default function LegacyManagementRedirect() {
  return <Navigate replace to="/settings/cotti-platform?section=people" />;
}
