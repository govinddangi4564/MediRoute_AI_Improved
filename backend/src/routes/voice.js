import { Router } from 'express';
import twilio from 'twilio';
import { Patient } from '../models/patient.js';
import { io } from '../server.js';
import { analyzeWithGemini } from '../services/gemini.js';

const router = Router();
const { twiml } = twilio;

// 1. Twilio hits this when a real phone call comes in
router.post('/incoming', (req, res) => {
  const response = new twiml.VoiceResponse();
  
  response.say({ voice: 'Polly.Aditi' }, 
    'Welcome to the Mediroute Emergency AI. Please clearly state your emergency, your symptoms, and your location after the beep.'
  );

  // Record user's speech and transcribe in real-time
  // Action URL gets hit when they stop talking
  response.gather({
    input: 'speech',
    action: '/api/voice/analyze',
    timeout: 3,
    speechTimeout: 'auto',
    language: 'en-IN'
  });

  // Fallback if they say nothing
  response.say({ voice: 'Polly.Aditi' }, 'We did not hear anything. Goodbye.');
  
  res.type('text/xml');
  return res.send(response.toString());
});

// 2. Twilio hits this with the transcribed speech
router.post('/analyze', async (req, res) => {
  const response = new twiml.VoiceResponse();
  const speechText = req.body.SpeechResult;

  if (!speechText) {
    response.say({ voice: 'Polly.Aditi' }, 'We could not understand you. An operator will be assigned shortly.');
    res.type('text/xml');
    return res.send(response.toString());
  }

  try {
    console.log("Transcribed Emergency:", speechText);

    // Run the transcribed voice through Gemini
    const analysis = await analyzeWithGemini(speechText, 'en');

    // Save the emergency to DB
    const patient = new Patient({
      symptoms: speechText,
      language: 'en',
      severity: analysis.severity,
      emergencyLevel: analysis.emergencyLevel,
      possibleDisease: analysis.possibleDisease,
      department: analysis.department,
      status: 'pending'
    });
    
    await patient.save();
    
    // Broadcast instantly to Hospital Dashboard
    io.emit('new_emergency', patient);

    // Tell the caller what happened
    response.say({ voice: 'Polly.Aditi' }, 
      `Emergency registered. We have detected a possible ${analysis.possibleDisease}. A hospital in the ${analysis.department} network has been notified and an ambulance is being dispatched.`
    );
    
    res.type('text/xml');
    return res.send(response.toString());
  } catch (err) {
    console.error('Voice analysis failed:', err);
    response.say({ voice: 'Polly.Aditi' }, 'Sorry, our AI is currently down. Please hold for a human operator.');
    res.type('text/xml');
    return res.send(response.toString());
  }
});

// 3. Keep the old mock endpoint just in case you want to click the button on the website
router.post('/test-call', async (req, res) => {
  const mockSymptoms = "Patient reported severe chest pain radiating to the left arm and shortness of breath over a phone call.";
  try {
    const patient = new Patient({
      symptoms: mockSymptoms,
      language: 'en',
      severity: 'critical',
      emergencyLevel: 'Cardiac Emergency',
      possibleDisease: 'Myocardial Infarction',
      department: 'Cardiology / ER',
      status: 'pending'
    });
    await patient.save();
    io.emit('new_emergency', patient);
    return res.json({ message: "Mock success" });
  } catch (err) {
    return res.status(500).json({ message: 'Error' });
  }
});

export default router;
