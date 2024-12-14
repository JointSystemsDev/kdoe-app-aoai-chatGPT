import { UserInfo } from '../api/models';

export interface AppUserInfo {
  userId: string;
  name: string;
  isAdmin: boolean;
  isPowerUser: boolean;
}

export async function initializeUserInfo(userInfoList: UserInfo[]): Promise<AppUserInfo | null> {
  if (!userInfoList || userInfoList.length === 0) {
    return null;
  }

  const userInfo = userInfoList[0];
  
  // Find the name and role claims
  const nameClaim = userInfo.user_claims.find(claim => claim.typ === 'name');
  const roleClaim = userInfo.user_claims.find(claim => claim.typ === 'roles');

  // Check roles
  const roles = roleClaim ? roleClaim.val.split(',').map((r: string) => r.trim()) : [];
  const isAdmin = roles.includes('admin');
  const isPowerUser = roles.includes('poweruser');

  return {
    userId: userInfo.user_id,
    name: nameClaim ? nameClaim.val : 'Unknown User',
    isAdmin,
    isPowerUser
  };
}

// Optional: Add helper functions to check user roles
export const isUserAdmin = (userInfo: AppUserInfo | null): boolean => {
  return !!userInfo?.isAdmin;
};

export const isUserPowerUser = (userInfo: AppUserInfo | null): boolean => {
  return !!userInfo?.isPowerUser;
};

export const hasConfigurationAccess = (userInfo: AppUserInfo | null): boolean => {
  return !!userInfo && (userInfo.isAdmin || userInfo.isPowerUser);
};