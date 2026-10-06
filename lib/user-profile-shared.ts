export const builtInAvatarIds = [
  "avatar-01",
  "avatar-02",
  "avatar-03",
  "avatar-04",
  "avatar-05",
  "avatar-06",
  "avatar-07",
  "avatar-08",
  "avatar-09",
  "avatar-10",
  "avatar-11",
  "avatar-12",
] as const;

export type UserProfile = {
  displayName: string;
  avatar: string;
};

export function isBuiltInAvatarId(value: unknown): value is (typeof builtInAvatarIds)[number] {
  return (
    typeof value === "string" &&
    (builtInAvatarIds as readonly string[]).includes(value)
  );
}

export function isProfileAvatar(value: unknown): value is string {
  return (
    isBuiltInAvatarId(value) ||
    (typeof value === "string" &&
      /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(
        value,
      ) &&
      value.length <= 2_800_000)
  );
}

export function isUserProfile(value: unknown): value is UserProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "displayName" in value &&
    typeof value.displayName === "string" &&
    value.displayName.length >= 1 &&
    value.displayName.length <= 40 &&
    value.displayName.trim() === value.displayName &&
    !/[\u0000-\u001f\u007f]/.test(value.displayName) &&
    "avatar" in value &&
    isProfileAvatar(value.avatar)
  );
}

export function defaultUserProfile(email: string): UserProfile {
  return {
    displayName: email.split("@")[0].slice(0, 40) || "User",
    avatar: builtInAvatarIds[0],
  };
}

export function avatarImageSource(avatar: string) {
  return isBuiltInAvatarId(avatar) ? `/avatars/${avatar}.svg` : avatar;
}
