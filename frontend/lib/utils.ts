import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const severityColor: Record<string, string> = {
  low: 'text-success bg-green-50 border-green-200',
  moderate: 'text-warning bg-amber-50 border-amber-200',
  high: 'text-danger bg-red-50 border-red-200',
  critical: 'text-white bg-danger border-danger'
};

export function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playBeep = (time: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, time);
      
      gainNode.gain.setValueAtTime(0.1, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.3);
    };

    // Play a double beep
    playBeep(ctx.currentTime);
    playBeep(ctx.currentTime + 0.15);
  } catch (e) {
    console.error("Audio play failed or blocked", e);
  }
}
