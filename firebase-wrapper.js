import { initializeApp } from "firebase/app";
import { getDatabase, ref, child, get, set, onValue } from "firebase/database";

export class FirebaseWrapper {
  constructor(url) {
    this.app = initializeApp({
      databaseURL: url,
    });
    this.db = getDatabase();
    this.dbRef = ref(this.db);
  }

  async get(path) {
    return (await get(child(this.dbRef, path))).val();
  }

  async set(path, data) {
    await set(ref(this.db, path), data);
  }

  watch(path, onChange) {
    onValue(ref(this.db, path), onChange);
  }

  getDb() {
    return this.db;
  }
}
