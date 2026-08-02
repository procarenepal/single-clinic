import 'dotenv/config';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const docRef = doc(db, 'doctors', 'TFMMmQ92a70AE3X3xKhV');
  await updateDoc(docRef, { email: 'deepahsclh@gmail.com' });
  console.log('Updated Deepa email');
  process.exit(0);
}
main().catch(console.error);
