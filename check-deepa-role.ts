import 'dotenv/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const q = query(collection(db, 'users'), where('email', '==', 'deepahscdh@gmail.com'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('User not found');
  } else {
    snap.docs.forEach(doc => {
      console.log('User role:', doc.data().role);
    });
  }
  process.exit(0);
}
main().catch(console.error);
