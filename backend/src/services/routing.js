import { HospitalUser } from '../models/hospitalUser.js';
import { Patient } from '../models/patient.js';
import { io } from '../server.js';

const RADIUS_STEPS = [5000, 15000, 50000]; // in meters (5km, 15km, 50km)
const WAIT_TIME = 15000; // 15 seconds per radius

export const startEmergencyRouting = async (patientId) => {
  let currentStep = 0;

  const loop = setInterval(async () => {
    try {
      // 1. Fetch latest patient state
      const patient = await Patient.findById(patientId);
      if (!patient || patient.status !== 'pending') {
        console.log(`Routing stopped for ${patientId}: already handled or not found.`);
        clearInterval(loop);
        return;
      }

      // 2. Check if we exhausted our radius steps
      if (currentStep >= RADIUS_STEPS.length) {
        console.log(`Exhausted radius steps for ${patientId}. Broadcasting globally.`);
        io.emit('new_emergency', patient);
        clearInterval(loop);
        return;
      }

      const radiusMeters = RADIUS_STEPS[currentStep];
      console.log(`Routing ${patientId} with radius ${radiusMeters}m...`);

      // 3. Find hospitals within this radius
      const hospitals = await HospitalUser.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: patient.location.coordinates
            },
            $maxDistance: radiusMeters
          }
        }
      });

      console.log(`Found ${hospitals.length} hospitals in ${radiusMeters}m radius.`);

      // 4. Send targeted socket event to these specific hospitals
      hospitals.forEach(hospital => {
        io.to(`hospital_${hospital._id}`).emit('new_emergency', patient);
      });

      // 5. Increment step for next tick
      currentStep++;

    } catch (err) {
      console.error('Error in routing engine:', err);
      clearInterval(loop);
    }
  }, WAIT_TIME);
};
