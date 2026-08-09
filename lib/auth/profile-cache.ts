import type { Profile } from "@/lib/types/database";

/** Survives soft navigations in the same browser tab. */
let profileCache: Profile | null = null;
let profilePromise: Promise<Profile | null> | null = null;

export function getCachedProfile() {
  return profileCache;
}

export function setCachedProfile(profile: Profile | null) {
  profileCache = profile;
}

export function clearProfileCache() {
  profileCache = null;
  profilePromise = null;
}

export function loadProfileOnce(
  loader: () => Promise<Profile | null>
): Promise<Profile | null> {
  if (profileCache) return Promise.resolve(profileCache);
  if (profilePromise) return profilePromise;

  profilePromise = loader()
    .then((profile) => {
      profileCache = profile;
      return profile;
    })
    .finally(() => {
      profilePromise = null;
    });

  return profilePromise;
}
