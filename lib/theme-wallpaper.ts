const databaseName = "evil-lander-theme-wallpapers";
const storeName = "wallpapers";

function openWallpaperDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support local wallpaper storage."));
      return;
    }

    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open wallpaper storage."));
    request.onblocked = () =>
      reject(new Error("Wallpaper storage is busy in another browser tab."));
  });
}

export async function saveThemeWallpaper(key: string, image: Blob) {
  const database = await openWallpaperDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(image, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Unable to save wallpaper image."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Wallpaper storage ran out of space."));
    });
  } finally {
    database.close();
  }
}

export async function loadThemeWallpaper(key: string) {
  const database = await openWallpaperDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => {
        const value: unknown = request.result;
        resolve(value instanceof Blob ? value : null);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to load wallpaper image."));
    });
  } finally {
    database.close();
  }
}

export async function listThemeWallpapers(): Promise<string[]> {
  const database = await openWallpaperDatabase();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAllKeys();
      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to list wallpaper keys."));
    });
  } finally {
    database.close();
  }
}
