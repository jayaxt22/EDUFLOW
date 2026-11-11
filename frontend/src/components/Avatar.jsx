import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../services/api';

/**
 * Reusable Avatar component for EduFlow ERP.
 * Renders avatar image if available with automatic API host resolution for media files.
 * Falls back to high-contrast initials (e.g. "DA") if no photo exists or if image fails to load.
 */
export const Avatar = ({
  user,
  size = 'md',
  className = '',
  alt = ''
}) => {
  const [imgError, setImgError] = useState(false);

  // Extract avatar URL from user object
  const rawUrl = user?.avatar || user?.avatar_url || user?.photo_url || null;

  // Reset error state if avatar URL changes
  useEffect(() => {
    setImgError(false);
  }, [rawUrl]);

  // Compute full image URL
  const getFullAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    const base = getApiBaseUrl();
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${base}${cleanUrl}`;
  };

  const avatarSrc = getFullAvatarUrl(rawUrl);

  // Compute initials fallback (e.g., "John Doe" -> "JD", "Admin" -> "A")
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const displayName = user?.full_name || user?.name || user?.username || '';
  const initials = getInitials(displayName);

  // Size styling presets
  const sizeStyles = {
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-2xl',
  };

  const chosenSizeClass = sizeStyles[size] || size;
  const isRoundedFull = !className.includes('rounded-');

  return (
    <div
      className={`relative inline-flex items-center justify-center font-bold shrink-0 overflow-hidden select-none ${
        isRoundedFull ? 'rounded-full' : ''
      } ${chosenSizeClass} ${className}`}
    >
      {avatarSrc && !imgError ? (
        <img
          src={avatarSrc}
          alt={alt || displayName || 'User avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full bg-[#1E293B] text-yellow-400 font-extrabold flex items-center justify-center shadow-inner">
          {initials}
        </div>
      )}
    </div>
  );
};
