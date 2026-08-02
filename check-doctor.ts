import 'dotenv/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const q = query(collection(db, 'doctors'), where('email', '==', 'deepahsclh@gmail.com'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('Doctor not found with this email');
  } else {
    snap.docs.forEach(doc => {
      console.log('Doctor:', doc.id, doc.data().name, doc.data().email);
    });
  }
  process.exit(0);
}
main().catch(console.error);
