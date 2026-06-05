export const mockEmergencyCall = async (hospitalName, hospitalPhone, patientProfile) => {
  console.log('----------------------------------------------------');
  console.log(`[TWILIO SIMULATION] Initiating call to: ${hospitalPhone || 'Unknown Number'}`);
  console.log(`[TWILIO SIMULATION] Ringing ${hospitalName}...`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(`[TWILIO SIMULATION] Call Connected.`);
  console.log(`[TWILIO SIMULATION] AI Voice: "Emergency Alert from MediRoute."`);
  console.log(`[TWILIO SIMULATION] AI Voice: "A patient requires an immediate ambulance."`);
  
  if (patientProfile.symptoms) {
    console.log(`[TWILIO SIMULATION] AI Voice: "Reported symptoms: ${patientProfile.symptoms}."`);
  }
  
  console.log(`[TWILIO SIMULATION] AI Voice: "Please dispatch a unit to the coordinates immediately."`);
  console.log(`[TWILIO SIMULATION] Call Disconnected.`);
  console.log('----------------------------------------------------');
};
