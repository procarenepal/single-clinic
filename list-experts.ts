import 'dotenv/config';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from './src/config/firebase';

async function main() {
  const q = query(collection(db, 'experts'));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log('No experts found in the database.');
  } else {
    console.log(`Found ${snap.size} experts:`);
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Email: ${data.email || 'N/A'}`);
      console.log(`  Speciality: ${data.speciality || 'N/A'}`);
      console.log(`  Clinic ID: ${data.clinicId || 'N/A'}`);
      console.log('---');
    });
  }
  process.exit(0);
}

main().catch(console.error);
