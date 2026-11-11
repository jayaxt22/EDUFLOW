import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminHomeView } from './AdminHomeView';
import { TeacherHomeView } from './TeacherHomeView';
import { StudentHomeView } from './StudentHomeView';
import { StaffHomeView } from './StaffHomeView';

export const DashboardView = ({
  users = [],
  onNavigateToUsers,
  onOpenCreateUser,
  onNavigateTab
}) => {
  const { user } = useAuth();
  const role = user?.role;

  if (role === 'ADMIN') {
    return (
      <AdminHomeView
        users={users}
        onNavigateToUsers={onNavigateToUsers}
        onOpenCreateUser={onOpenCreateUser}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  if (role === 'TEACHER') {
    return <TeacherHomeView onNavigateTab={onNavigateTab} user={user} />;
  }

  if (role === 'STUDENT') {
    return <StudentHomeView onNavigateTab={onNavigateTab} user={user} />;
  }

  if (role === 'STAFF') {
    return <StaffHomeView onNavigateTab={onNavigateTab} user={user} />;
  }

  return (
    <div className="bg-white rounded-xl p-8 border border-gray-200 text-center text-gray-500">
      <p>Welcome to EduFlow ERP.</p>
    </div>
  );
};
