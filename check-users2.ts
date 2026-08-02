import 'dotenv/config';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const q = query(collection(db, 'users'));
  const snap = await getDocs(q);
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.email) {
      console.log(data.email, data.role);
    }
  });
  process.exit(0);
}
main().catch(console.error);
