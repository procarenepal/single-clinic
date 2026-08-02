import 'dotenv/config';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const prescriptionsSnap = await getDocs(collection(db, 'prescriptions'));
  console.log('Prescriptions to delete:', prescriptionsSnap.size);

  let deleted = 0;
  for (let d of prescriptionsSnap.docs) {
    await deleteDoc(d.ref);
    deleted++;
  }

  console.log('Successfully deleted', deleted, 'prescriptions.');
  process.exit(0);
}

main().catch(console.error);
