import 'dotenv/config';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const q = query(collection(db, 'doctors'));
  const snap = await getDocs(q);
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.name?.toLowerCase().includes('deepa')) {
      console.log('Found Deepa:', doc.id, data.name, 'Email:', data.email);
    }
  });
  process.exit(0);
}
main().catch(console.error);
