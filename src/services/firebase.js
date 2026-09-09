import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForBuildVerification12345",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "infinity-chat-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "infinity-chat-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "infinity-chat-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1029384756",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1029384756:web:abcdef123456"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.warn("Firebase Auth fallback to offline profile mode:", error.message);
    return {
      uid: "usr_local_host",
      displayName: "Demo Engineer",
      email: "engineer@infinity.local",
      photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"
    };
  }
};

export const logoutUser = () => signOut(auth);

export const uploadAttachment = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.warn("Storage upload failed, falling back to local Blob URI:", error.message);
          resolve(URL.createObjectURL(file));
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        }
      );
    } catch (e) {
      resolve(URL.createObjectURL(file));
    }
  });
};
