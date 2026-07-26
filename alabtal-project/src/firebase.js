import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// عدّل القيم دي بالإعدادات اللي هتاخدها من Firebase Console (شرح في README.md)
const firebaseConfig = {
  apiKey: "AIzaSyD2vwebaFvtxi6BxfaY_grrVrTyGwWps2w",
  authDomain: "easymath-fb7a0.firebaseapp.com",
  databaseURL: "https://easymath-fb7a0-default-rtdb.firebaseio.com",
  projectId: "easymath-fb7a0",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const DB_URL = firebaseConfig.databaseURL;
