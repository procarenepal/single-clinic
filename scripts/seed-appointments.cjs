const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const doctors = ['2K1isNKakBIcvisV4XOb', 'RsuGHUeYUXmhmEX6thPX'];
const patients = ['039PPhmWraLLH7jhvb0j', '5gaK4vPxpcLb7ViNSG3x', 'Ism5drT65QgISvFIZWSL', 'LnoxXpeh97zakecuY0Cp', 'P7g14UpyzlwQMIsJoIB4'];

const statuses = ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled'];
const types = ['general', 'follow-up', 'consultation']; // Assuming IDs match or just strings for now

async function seedAppointments() {
    console.log('Seeding mock appointments...');
    const appointmentsRef = collection(db, 'appointments');
    let count = 0;

    const today = new Date();
    
    // Create 15 appointments
    for (let i = 0; i < 15; i++) {
        // Distribute dates: some today, some past, some future
        const dateOffset = Math.floor(Math.random() * 10) - 5; // -5 to +4 days
        const apptDate = new Date(today);
        apptDate.setDate(today.getDate() + dateOffset);
        
        // Ensure today has a few appointments
        if (i < 5) {
            apptDate.setDate(today.getDate());
        }

        const dateString = apptDate.toISOString().split('T')[0];
        const hour = Math.floor(Math.random() * 8) + 9; // 9 AM to 4 PM
        const timeString = `${hour.toString().padStart(2, '0')}:00`;

        const doctorId = doctors[Math.floor(Math.random() * doctors.length)];
        const patientId = patients[Math.floor(Math.random() * patients.length)];
        
        // Status logic based on date
        let status = statuses[0];
        if (dateOffset < 0) {
            status = Math.random() > 0.2 ? 'completed' : 'cancelled';
        } else if (dateOffset === 0) {
            status = statuses[Math.floor(Math.random() * 4)]; // Any except cancelled usually
        }

        const appointment = {
            clinicId: 'default',
            branchId: 'default',
            patientId,
            doctorId,
            appointmentTypeId: types[Math.floor(Math.random() * types.length)],
            appointmentDate: dateString,
            startTime: timeString,
            status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            paymentStatus: 'pending'
        };

        try {
            const docRef = await addDoc(appointmentsRef, appointment);
            console.log(`Created appointment: ${docRef.id} on ${dateString}`);
            count++;
        } catch (e) {
            console.error(`Failed to create appointment:`, e);
        }
    }

    console.log(`Successfully seeded ${count} appointments.`);
    process.exit(0);
}

seedAppointments();
