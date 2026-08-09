import type { Profile } from "@/lib/types/database";

/** Survives soft navigations in the same browser tab. */
let profileCache: Profile | null = null;
let profilePromise: Promise<Profile | null> | null = null;

type Listener = (profile: Profile | null) => void;
const listeners = new Set<Listener>();

export function getCachedProfile() {
  return profileCache;
}

export function setCachedProfile(profile: Profile | null) {
  profileCache = profile;
  for (const listener of listeners) {
    listener(profile);
  }
}

export function subscribeProfileCache(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearProfileCache() {
  profileCache = null;
  profilePromise = null;
  for (const listener of listeners) {
    listener(null);
  }
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

/** Force next loadProfileOnce to refetch (e.g. after account email change). */
export function invalidateProfileCache() {
  profilePromise = null;
  profileCache = null;
}
