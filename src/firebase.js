// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// تأكد من وجود getFirestore هنا داخل الأقواس
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYE2xngyrvA85kZBeTxhseeHetYH1-yEw",
  authDomain: "attendance-sys-a168c.firebaseapp.com",
  projectId: "attendance-sys-a168c",
  storageBucket: "attendance-sys-a168c.firebasestorage.app",
  messagingSenderId: "83516867202",
  appId: "1:83516867202:web:dc4e07506cd1fc890f2a9b"
};

// تشغيل فير بيز
const app = initializeApp(firebaseConfig);

// تصدير قاعدة البيانات لاستخدامها في App.jsx
export const db = getFirestore(app);